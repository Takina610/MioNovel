//! 小窗模式（桌面端）。
//!
//! 一个「永远在别的软件上面」的第二窗口：阅读设置里开了小窗，它就落在用户
//! 挑定的那个角上。平时是**藏着的**——鼠标挪进它占据的那块屏幕区域才显示，
//! 离开立刻藏回去。层级与显隐只有壳管得了，所以这件事做在 Rust 这边：
//! 一个轮询线程盯着光标进没进窗口矩形，进就 show、出就 hide。前端只通过
//! [`mini_apply`] 把设置（开关、落角、系统级快捷键）推过来。
//!
//! 窗口内容还是同一份前端：initialization_script 塞一个 `window.__MN_MINI__`，
//! 页面据此渲染成小窗（书架列表 + 正文）。两个窗口都指向**同一个** WebView2
//! 用户数据目录（便携模式同理），IndexedDB 才是同一份——小窗里的书架才读得到
//! 主窗口导进去的书。
//!
//! 用户可以拖边缘改大小：`resizable(true)` + 页面每 300ms 把
//! innerWidth/innerHeight 上报（[`mini_report_size`]）。尺寸记在
//! last_size（会话内）+ 数据目录的 mini-size.json（跨重启）。

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use serde::Deserialize;
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// 轮询鼠标的间隔。太密费电，太疏「离开就消失」就迟钝
const POLL_INTERVAL: Duration = Duration::from_millis(120);
/// 主窗口最小化多久后挂起它的 WebView2（后台省内存）。太短，快速最小化/
/// 还原会来回挂起；太长，用户「最小化当托盘用」要等很久才见效
const MINIMIZE_SUSPEND_DELAY: Duration = Duration::from_secs(10);
/// 内置尺寸（逻辑像素）。物理尺寸随 DPI 放大，落角按 outer_size 反推
const MINI_WIDTH: f64 = 340.0;
const MINI_HEIGHT: f64 = 420.0;
/// 贴屏幕边的留白
const EDGE_MARGIN: i32 = 12;
/// 拖拽大小的合法范围（逻辑像素）。太小的窗放不下头部一排按钮，太大就不是小窗了
const MIN_SIZE: (f64, f64) = (240.0, 320.0);
const MAX_SIZE: (f64, f64) = (800.0, 1200.0);

pub const MINI_LABEL: &str = "mini";
pub const MAIN_LABEL: &str = "main";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MiniConfig {
    pub enabled: bool,
    /// top-left / top-right / bottom-left / bottom-right
    pub corner: String,
    /// 系统级快捷键（阅读设置里小窗那一栏绑的串，可以多枚）。空 = 没绑键
    #[serde(default)]
    pub hotkeys: Vec<String>,
    /// **全局主题 id**：小窗的视觉直接用它。不走 localStorage——
    /// WebView2 的 localStorage 跨进程可见性有延迟，销毁重建的小窗会读到
    /// 旧主题（踩过：切了主题重开小窗还是旧颜色）。apply_windows 在小窗
    /// 就绪后用 webview eval 把它注进去
    #[serde(default)]
    pub theme_id: String,
}

fn clamp_size(width: Option<f64>, height: Option<f64>) -> (f64, f64) {
    let clamp = |value: f64, (min, max): (f64, f64)| value.clamp(min, max);
    // 注意各自的 min/max：宽 (240, 800)、高 (320, 1200)。此前把 MAX_SIZE
    // 整个给了高度——高度被钳到最少 800，拖出来的新尺寸全被顶回旧值，
    // 对账永远「无变化」不落盘（踩过）
    (
        width.map(|w| clamp(w, (MIN_SIZE.0, MAX_SIZE.0))).unwrap_or(MINI_WIDTH),
        height.map(|h| clamp(h, (MIN_SIZE.1, MAX_SIZE.1))).unwrap_or(MINI_HEIGHT),
    )
}

pub struct MiniState {
    /// 最近一次推过来的配置。轮询线程只读它
    config: Mutex<Option<MiniConfig>>,
    /// 便携模式的数据目录。第二个窗口必须指向同一个 WebView2 用户数据目录，
    /// 不然小窗里是另一个 IndexedDB——空书架
    data_dir: Mutex<Option<PathBuf>>,
    /// 系统快捷键按下过一次（等前端来取走）。走轮询不走事件：
    /// 这个壳本来就在轮询光标，前端多扫一个 500ms 的标志位不值一提，
    /// 却省掉了事件那套（订阅时序、权限、名字校验）的排障成本
    toggle_requested: std::sync::atomic::AtomicBool,
    /// 小窗里的「放大」按钮按过一次（等主窗口来取走，把设置翻回关）
    restore_requested: std::sync::atomic::AtomicBool,
    /// 用户拖拽出来的**当前**尺寸（逻辑像素）——尺寸的唯一权威，
    /// 小窗页面每 300ms 上报（mini_report_size），建窗优先用它
    last_size: std::sync::Arc<Mutex<Option<(f64, f64)>>>,
    /// 最近一次收到 Resized 事件的时刻：拖拽进行中（600ms 内还有事件），
    /// 轮询线程完全让路——贴角定位会跟模态缩放循环抢位置，把拖拽搅黄（踩过）
    last_resize: std::sync::Arc<Mutex<Option<std::time::Instant>>>,
    /// 尺寸落盘的文件（数据目录里的 mini-size.json）。None = 没地方写
    size_file: Mutex<Option<PathBuf>>,
    /// 主窗口的 WebView2 此刻是否处于挂起/省内存态（lib.rs 的 trim_main_webview
    /// 与本文件的 poll_minimized 共同读写——托盘/小窗/最小化三条路都走它）
    pub(crate) main_trimmed: std::sync::atomic::AtomicBool,
    /// 主窗口是从什么时候开始最小化的。None = 不在最小化态
    main_minimized_since: Mutex<Option<std::time::Instant>>,
}

impl MiniState {
    /// run() 里 manage 一次；state() 在 manage 之前调用会当场 panic
    pub fn new() -> Self {
        Self {
            config: Mutex::new(None),
            data_dir: Mutex::new(None),
            toggle_requested: std::sync::atomic::AtomicBool::new(false),
            restore_requested: std::sync::atomic::AtomicBool::new(false),
            last_size: std::sync::Arc::new(Mutex::new(None)),
            last_resize: std::sync::Arc::new(Mutex::new(None)),
            size_file: Mutex::new(None),
            main_trimmed: std::sync::atomic::AtomicBool::new(false),
            main_minimized_since: Mutex::new(None),
        }
    }

    /// 小窗此刻开没开。托盘的显隐与「关主窗 = 藏还是退」（lib.rs）都要问它：
    /// 小窗开着时关主窗只能藏——退出会把悬浮的小窗一起带走
    pub fn mini_enabled(&self) -> bool {
        self.config
            .lock()
            .unwrap()
            .as_ref()
            .map(|config| config.enabled)
            .unwrap_or(false)
    }
}

/// 启动轮询线程。setup 里调用一次。size_file：尺寸的跨重启持久化文件
pub fn start(app: &AppHandle, data_dir: Option<PathBuf>) {
    let size_file = data_dir
        .clone()
        .or_else(|| app.path().app_data_dir().ok())
        .map(|dir| dir.join("mini-size.json"));
    *app.state::<MiniState>().size_file.lock().unwrap() = size_file;
    {
        let state = app.state::<MiniState>();
        *state.data_dir.lock().unwrap() = data_dir;
    }
    let handle = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(POLL_INTERVAL);
        poll_hover(&handle);
    });
}

/// 前端把设置推过来。开关、落角、快捷键变了都走这里；重复推是幂等的。
///
/// **必须是 async**：同步 command 跑在主线程上，而下面窗口的创建、定位、
/// 查位置都要经 dispatcher 等事件循环应答——主线程自己等着自己，整个壳
/// 连同悬浮轮询线程一起死锁（踩过：窗口建出来了、定位永远没跑、日志停在半截）。
/// async 让它跑在运行时线程上，dispatcher 调用才有人应答。
#[tauri::command]
pub async fn mini_apply(app: AppHandle, config: MiniConfig) -> Result<(), String> {
    match config.corner.as_str() {
        "top-left" | "top-right" | "bottom-left" | "bottom-right" => {}
        other => return Err(format!("不认识的角落：{other}")),
    }

    // 状态先落：轮询线程只认这份配置。窗口操作万一出错（建不出来、定位失败），
    // 轮询线程下一拍还会按这份配置再试，而不是卡在「配置为空」里永远早退
    *app.state::<MiniState>().config.lock().unwrap() = Some(config.clone());

    // 快捷键：不管小窗开没开，键都得能把窗户叫出来（不然关了就再也开不了）
    apply_hotkeys(&app, &config.hotkeys);

    apply_windows(&app, &config);
    Ok(())
}

/// 配置里的**窗口部分**：小窗建/关 + **主窗口联动**。
/// 开着小窗时主窗口整个藏起来（摸鱼的完整形态：任务栏里像没有这个应用）；
/// 关掉时主窗口必须回来——藏着的窗口没有别的路能还原。
/// 三条路都走到这里：前端推配置、快捷键在壳里翻转、小窗里的「放大」按钮。
fn apply_windows(app: &AppHandle, config: &MiniConfig) {
    if config.enabled {
        // 开小窗前把主窗口整个藏起来（摸鱼的完整形态：任务栏里像没有这个应用）。
        // 藏完顺带挂起它的 WebView2（lib.rs 的 hide_main_window）——挂起中的
        // 页面不跑 JS，主窗口那 500ms 的标志轮询也停了，无妨：窗口行为都在壳里
        // 即时做，标志等主窗口回来（resume）后第一拍补同步
        crate::hide_main_window(app);
        match ensure_window(app, config) {
            Ok(window) => {
                place(&window, &config.corner);
                push_theme(&window, &config.theme_id);
            }
            Err(err) => {
                log(format!("小窗创建失败：{err}"));
                // 建不出来就把主窗口还回去，别让用户两边都扑空
                crate::show_main_window(app);
            }
        }
    } else {
        // **销毁而不是常驻**：一份 webview 就是几十 MB 的渲染进程，
        // 用户关了小窗它们就该还给系统（内存是第一投诉）。用户拖的尺寸
        // 已经落盘在 mini-size.json，重建时原样恢复；阅读进度在 IndexedDB
        // 里也没丢过。主窗口此时多半还藏着，一并还原（show_main_window
        // 会先 Resume 挂起的 WebView2）
        if let Some(window) = app.get_webview_window(MINI_LABEL) {
            win32_set_visible(&window, false);
            let _ = window.close();
        }
        if let Some(main) = app.get_webview_window(MAIN_LABEL) {
            if !main.is_visible().unwrap_or(false) {
                crate::show_main_window(app);
            }
        }
    }
    // 托盘跟着小窗的开关走（lib.rs）：主窗口藏起来的期间，通知区得有图标
    // 能把它请回来
    crate::sync_tray(app);
}



/// 把全局主题 id 注进小窗页面（webview eval）。小窗挂了
/// window.__MN_APPLY_THEME__（src/mini/MiniApp.tsx）来接：重设 :root 的
/// data-theme，小窗立即换装。主题在 localStorage 里的同步有延迟，
/// 这条通道才是即时的
fn push_theme(window: &WebviewWindow, theme_id: &str) {
    if theme_id.trim().is_empty() {
        return;
    }
    let id = serde_json::to_string(theme_id).unwrap_or_else(|_| String::from("\"day\""));
    let _ = window.eval(&format!(
        "window.__MN_APPLY_THEME__ && window.__MN_APPLY_THEME__({id})"
    ));
}
/// 主窗口最小化超过 MINIMIZE_SUSPEND_DELAY 就挂起它的 WebView2（后台省内存），
/// 还原即恢复。状态标志只有 main_trimmed 一份，托盘/小窗的藏窗路径
/// （lib.rs 的 hide_main_window / show_main_window）读写的是同一个。
///
/// **只管「可见但最小化」的窗口**：藏进托盘/小窗模式（窗口已隐藏）的挂起
/// 归 lib.rs 管——隐藏的窗口 IsIconic 恒为 false，这里若插手会把托盘挂起
/// 又给恢复回去，内存白省。
fn poll_minimized(app: &AppHandle) {
    let Some(main) = app.get_webview_window(MAIN_LABEL) else {
        return;
    };
    if !win32_visible(&main) {
        return;
    }
    let iconic = main_is_iconic(&main);
    let trimmed = app
        .state::<MiniState>()
        .main_trimmed
        .load(std::sync::atomic::Ordering::Relaxed);
    if iconic == trimmed {
        // 要么都「正常显示」（无事可做），要么都「最小化且已挂起」（等还原）
        return;
    }
    if iconic {
        let state = app.state::<MiniState>();
        let since = {
            let mut guard = state.main_minimized_since.lock().unwrap();
            *guard.get_or_insert_with(std::time::Instant::now)
        };
        if since.elapsed() < MINIMIZE_SUSPEND_DELAY {
            return;
        }
        crate::trim_main_webview(app, true);
    } else {
        // 还原了：清掉计时，恢复 WebView2
        let state = app.state::<MiniState>();
        *state.main_minimized_since.lock().unwrap() = None;
        crate::trim_main_webview(app, false);
    }
}

/// 主窗口是不是最小化态（Win32 直读：dispatcher 的查询从非主线程不可靠，
/// 见 window_physical_rect 上的注释）
#[cfg(windows)]
fn main_is_iconic(window: &WebviewWindow) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, IsIconic, GET_ANCESTOR_FLAGS};
    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let root = unsafe { GetAncestor(HWND(hwnd.0), GET_ANCESTOR_FLAGS(2)) }; // GA_ROOT
    unsafe { IsIconic(HWND(root.0)).as_bool() }
}

#[cfg(not(windows))]
fn main_is_iconic(_window: &WebviewWindow) -> bool {
    false
}

/// 悬浮显隐的一拍。悬浮区永远是「角落矩形」：位置钉在角上，
/// 拖拽改大小之后下一拍就按新尺寸重新贴角（锚定的两条边不动，另一边伸缩）
fn poll_hover(app: &AppHandle) {
    // 主窗口最小化 10s → 挂起它的 WebView2；还原 → 恢复。放在小窗逻辑之前：
    // 小窗没开（配置还是 None）的时候它也要工作
    poll_minimized(app);

    let (enabled, corner) = {
        let state = app.state::<MiniState>();
        let guard = state.config.lock().unwrap();
        match guard.as_ref() {
            Some(config) => (config.enabled, config.corner.clone()),
            None => return,
        }
    };
    let Some(window) = app.get_webview_window(MINI_LABEL) else {
        return;
    };
    // **关闭状态的第一件事就是兜底隐藏并收工**：apply_windows 的 hide 万一被
    // 后面的悬浮 show 抵消（分支曾在历次改动中丢失，用户报「关了还在」），
    // 这里每拍都把关闭状态按死
    if !enabled {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        }
        return;
    }
    // 用户正在拖拽（600ms 内还有 Resized 事件）时完全让路：
    // 贴角定位会跟模态缩放循环抢位置，把拖拽搅黄
    let dragging = app
        .state::<MiniState>()
        .last_resize
        .lock()
        .unwrap()
        .map(|at| at.elapsed() < Duration::from_millis(600))
        .unwrap_or(false);
    if dragging {
        return;
    }
    let visible = win32_visible(&window);

    // 拖拽改了尺寸：跟 last_size 对账，变了就记下（建窗 + 落盘用）。
    // 尺寸直读 OS（window_physical_rect）：dispatcher 的 outer_size 滞后（踩过），
    // 页面自己的 innerWidth/innerHeight 在模态循环里不更新（踩过），都靠不住
    if let Some((_, _, phys_w, phys_h)) = window_physical_rect(&window) {
        let scale = window_dpi(&window);
        let logical = clamp_size(Some(phys_w as f64 / scale), Some(phys_h as f64 / scale));
        let state = app.state::<MiniState>();
        let mut last = state.last_size.lock().unwrap();
        {
            thread_local! { static LTICK: std::cell::Cell<u32> = const { std::cell::Cell::new(0) }; }
        }
        if *last != Some(logical) {
            *last = Some(logical);
            drop(last);
            save_size_file(app, logical);
        }
    }

    let Ok(cursor) = app.cursor_position() else {
        log("poll：cursor_position 失败".into());
        return;
    };
    let Some(rect) = corner_rect(&window, &corner) else {
        log("poll：corner_rect 失败".into());
        return;
    };
    if let Some((x, y, _, _)) = window_physical_rect(&window) {
        if x != rect.x || y != rect.y {
            let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
        }
    }

    let inside = cursor.x >= rect.x as f64
        && cursor.x <= (rect.x + rect.w) as f64
        && cursor.y >= rect.y as f64
        && cursor.y <= (rect.y + rect.h) as f64;
    if inside && !visible {
        // WS_EX_NOACTIVATE（见 make_noactivate）保证这次 show 不会抢焦点：
        // 用户正打字的那个窗口不能被顶下去
        win32_set_visible(&window, true);
    } else if !inside && visible {
        win32_set_visible(&window, false);
    }
}

/// 对**顶层窗口**直调 Win32 显隐。dispatcher 的 hide 是排队的异步消息，
/// 轮询线程每 120ms 还在发一串查询，hide 会延迟到肉眼可见的「渐隐」；
/// `window.hwnd()` 拿到的 hwnd 取 GA_ROOT 归一到顶层窗口再 ShowWindow，
/// 立竿见影、零动画
#[cfg(windows)]
fn win32_set_visible(window: &WebviewWindow, visible: bool) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetAncestor, ShowWindow, GET_ANCESTOR_FLAGS, SHOW_WINDOW_CMD,
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let root = unsafe { GetAncestor(HWND(hwnd.0), GET_ANCESTOR_FLAGS(2)) }; // GA_ROOT
    let cmd = if visible { 5 } else { 0 }; // SW_SHOW / SW_HIDE
    unsafe { ShowWindow(HWND(root.0), SHOW_WINDOW_CMD(cmd)) };
}

#[cfg(not(windows))]
fn win32_set_visible(window: &WebviewWindow, visible: bool) {
    if visible {
        let _ = window.show();
    } else {
        let _ = window.hide();
    }
}

/// 直读顶层窗口的 WS_VISIBLE（dispatcher 的 is_visible 是缓存，
/// Win32 直调显隐后读它会拿到过期值）
#[cfg(windows)]
fn win32_visible(window: &WebviewWindow) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, IsWindowVisible, GET_ANCESTOR_FLAGS};
    let Ok(hwnd) = window.hwnd() else {
        return false;
    };
    let root = unsafe { GetAncestor(HWND(hwnd.0), GET_ANCESTOR_FLAGS(2)) };
    unsafe { IsWindowVisible(HWND(root.0)).as_bool() }
}

#[cfg(not(windows))]
fn win32_visible(window: &WebviewWindow) -> bool {
    window.is_visible().unwrap_or(false)
}

/// 小窗页面挂载完成后来要当前主题：此时它的 __MN_APPLY_THEME__ 已挂好，
/// eval 才不会丢（页面加载早期 eval 会落在空 JS 环境上，踩过）
#[tauri::command]
pub async fn mini_ready(app: AppHandle) {
    log("mini_ready：小窗页面来要主题了".into());
    let theme_id = {
        let state = app.state::<MiniState>();
        let guard = state.config.lock().unwrap();
        match guard.as_ref() {
            Some(config) => config.theme_id.clone(),
            None => return,
        }
    };
    if let Some(window) = app.get_webview_window(MINI_LABEL) {
        push_theme(&window, &theme_id);
        log(format!("mini_ready：已 push 主题 {}", theme_id));
    } else {
        log("mini_ready：mini 窗口不存在".into());
    }
}

/// 主显示器的工作区与 DPI（物理值），直调 Win32——
/// dispatcher 的 monitor/scale 查询从非主线程调用会返回默认值/失败
/// （scale 变 1.0、monitor 变 None，踩过），OS 直读永远可靠
#[cfg(windows)]
fn primary_work_area() -> (i32, i32, i32, i32, f64) {
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::HiDpi::GetDpiForSystem;
    unsafe {
        let hmon = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        let _ = GetMonitorInfoW(hmon, &mut info);
        let dpi = GetDpiForSystem();
        (
            info.rcWork.left,
            info.rcWork.top,
            info.rcWork.right - info.rcWork.left,
            info.rcWork.bottom - info.rcWork.top,
            dpi as f64 / 96.0,
        )
    }
}

#[cfg(not(windows))]
fn primary_work_area() -> (i32, i32, i32, i32, f64) {
    (0, 0, 2560, 1440, 1.0)
}

/// 窗口所在显示器的 DPI（物理像素每逻辑 96 份）
#[cfg(windows)]
fn window_dpi(window: &WebviewWindow) -> f64 {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::HiDpi::GetDpiForWindow;
    let Ok(hwnd) = window.hwnd() else {
        return 1.0;
    };
    unsafe { GetDpiForWindow(HWND(hwnd.0)) as f64 / 96.0 }
}

#[cfg(not(windows))]
fn window_dpi(window: &WebviewWindow) -> f64 {
    window.scale_factor().unwrap_or(1.0)
}

/// 直读窗口的真实物理矩形（OS 层，无缓存）。Windows 上走 GetWindowRect——
/// dispatcher 的 outer_size/outer_position 是排队的异步应答，拖拽刚结束时
/// 会拿到滞后的旧值（同一拍两次调用结果不同，踩过）；轮询线程要的是
/// 「此刻的真实矩形」，必须直读
#[cfg(windows)]
fn window_physical_rect(window: &WebviewWindow) -> Option<(i32, i32, i32, i32)> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;
    let Ok(hwnd) = window.hwnd() else {
        log("physical_rect：hwnd 拿不到".into());
        return None;
    };
    let mut rect = windows::Win32::Foundation::RECT::default();
    let ok = unsafe { GetWindowRect(HWND(hwnd.0), &mut rect) };
    if let Err(err) = ok {
        log(format!("physical_rect：GetWindowRect 失败：{err}"));
        return None;
    }
    Some((rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top))
}

/// 非 Windows 的退路：dispatcher（没有拖拽场景，够用）
#[cfg(not(windows))]
fn window_physical_rect(window: &WebviewWindow) -> Option<(i32, i32, i32, i32)> {
    let (Ok(origin), Ok(size)) = (window.outer_position(), window.outer_size()) else {
        return None;
    };
    Some((origin.x, origin.y, size.width as i32, size.height as i32))
}

struct Rect {
    x: i32,
    y: i32,
    w: i32,
    h: i32,
}

/// 窗口该在的角落矩形（按显示器工作区算，任务栏不占）。
/// 尺寸用窗口**此刻的物理尺寸**（outer_size）：inner_size 给的是逻辑像素，
/// 高 DPI 下物理尺寸是它的 scale 倍——按常量算会让窗的一部分探出屏幕外
fn corner_rect(window: &WebviewWindow, corner: &str) -> Option<Rect> {
    let (area_x, area_y, area_w, area_h, _dpi) = primary_work_area();
    let (width, height) = window_physical_rect(window)
        .map(|(_, _, w, h)| (w, h))
        .unwrap_or((MINI_WIDTH as i32, MINI_HEIGHT as i32));
    let (x, y) = corner_position(area_x, area_y, area_w, area_h, width, height, corner);
    Some(Rect { x, y, w: width, h: height })
}

/// 落角。窗口已存在时（换角落）也走这里
fn place(window: &WebviewWindow, corner: &str) {
    if let Some(rect) = corner_rect(window, corner) {
        let _ = window.set_position(PhysicalPosition::new(rect.x, rect.y));
    }
}

fn corner_position(
    area_x: i32,
    area_y: i32,
    area_w: i32,
    area_h: i32,
    width: i32,
    height: i32,
    corner: &str,
) -> (i32, i32) {
    let x = if corner.ends_with("right") {
        area_x + area_w - width - EDGE_MARGIN
    } else {
        area_x + EDGE_MARGIN
    };
    let y = if corner.starts_with("bottom") {
        area_y + area_h - height - EDGE_MARGIN
    } else {
        area_y + EDGE_MARGIN
    };
    (x, y)
}

/// 小窗已在就复用（里面读到的章节、滚动位置都还在），没有才建。
/// 尺寸的优先级：本次会话里用户拖出来的（last_size）> 上次落盘的
/// （mini-size.json，跨重启）> 内置默认
fn ensure_window(app: &AppHandle, config: &MiniConfig) -> tauri::Result<WebviewWindow> {
    if let Some(window) = app.get_webview_window(MINI_LABEL) {
        return Ok(window);
    }
    let state = app.state::<MiniState>();
    let last = state.last_size.lock().unwrap().clone();
    let (width, height) = last
        .or_else(|| load_size_file(&state.size_file.lock().unwrap()))
        .unwrap_or_else(|| (MINI_WIDTH, MINI_HEIGHT));
    let mut builder = WebviewWindowBuilder::new(app, MINI_LABEL, WebviewUrl::App("index.html".into()))
        .title("MioNovel")
        // 无框 + 透明：圆角和阴影由前端画（mini.css 的 .mn-mini），
        // 窗口本体不给背景
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        // 可拖边改大小（tao 对无框窗口做边缘命中测试）；尺寸归用户，不归 maximize
        .resizable(true)
        .maximizable(false)
        .minimizable(false)
        // webview 默认不随窗口伸缩（建窗时是隐藏的，更要显式开）：
        // 不开的话窗口拖边缩放了，页面 viewport 还卡在建窗尺寸（踩过）
        .auto_resize()
        .focused(false)
        .visible(false)
        .inner_size(width, height)
        // initialization_script 在页面任何 JS 之前执行：主题从这里给，
        // 页面首帧就是正确主题（localStorage 跨进程有延迟靠不住）
        .initialization_script(&format!(
            "window.__MN_MINI__ = true; window.__MN_THEME__ = {};",
            serde_json::to_string(config.theme_id.as_str()).unwrap_or_else(|_| String::from("\"day\""))
        ));
    // 建窗前先算好落角（Win32 直读工作区与 DPI）：
    // set_position / monitor 查询对刚建的隐藏窗口不可靠（踩过），
    // builder.position 一步到位
    {
        let (area_x, area_y, area_w, area_h, dpi) = primary_work_area();
        let (x, y) = corner_position(
            area_x,
            area_y,
            area_w,
            area_h,
            (width * dpi) as i32,
            (height * dpi) as i32,
            &config.corner,
        );
        builder = builder.position(x as f64 / dpi, y as f64 / dpi);
    }
    let data_dir = state.data_dir.lock().unwrap().clone();
    if let Some(dir) = data_dir {
        builder = builder.data_directory(dir);
    }
    let window = builder.build()?;
    #[cfg(windows)]
    make_noactivate(&window);
    // 拖拽检测：只认 Resized 事件（窗口尺寸真的在变），让轮询线程在拖拽
    // 期间让路。注意不能对**所有**事件刷新——Moved/Focused 也会来，
    // 无差别刷新会让 dragging 永远为 true、轮询整个停摆（踩过）
    let state = app.state::<MiniState>();
    let last_resize = state.last_resize.clone();
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Resized(_)) {
            *last_resize.lock().unwrap() = Some(std::time::Instant::now());
        }
    });
    Ok(window)
}

/// 系统级快捷键。组合变了就全拆了重挂；某一串认不出来只跳过那一串，
/// 不拖累别的（键位是前端给的，认不出来算配置错，不值得让整个 apply 失败）
fn apply_hotkeys(app: &AppHandle, hotkeys: &[String]) {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let manager = app.global_shortcut();
    let _ = manager.unregister_all();
    for combo in hotkeys {
        let trimmed = combo.trim();
        if trimmed.is_empty() {
            continue;
        }
        let shortcut = match trimmed.parse::<Shortcut>() {
            Ok(shortcut) => shortcut,
            Err(err) => {
                log(format!("小窗快捷键「{trimmed}」认不出来：{err}"));
                continue;
            }
        };
        let registered = manager.on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                // 窗口行为在这里**立刻**发生：主窗口藏着的时候，它的定时器被
                // 浏览器节流到 1s 起，等前端轮询再翻一遍就太慢了。翻转配置 +
                // 直接落地，标志留给主窗口的轮询把设置里的开关同步回去。
                let app = app.clone();
                std::thread::spawn(move || {
                    let state = app.state::<MiniState>();
                    let config = {
                        let mut guard = state.config.lock().unwrap();
                        match guard.as_ref() {
                            Some(current) => {
                                let next = MiniConfig { enabled: !current.enabled, ..current.clone() };
                                *guard = Some(next.clone());
                                next
                            }
                            // 配置还没从主窗口推过来就按了键：无从落角，忽略这一次
                            None => return,
                        }
                    };
                    state
                        .toggle_requested
                        .store(true, std::sync::atomic::Ordering::Relaxed);
                    apply_windows(&app, &config);
                });
            }
        });
        if let Err(err) = registered {
            log(format!("小窗快捷键「{trimmed}」注册失败：{err}"));
        }
    }
}

/// 把主窗口请回来。两个入口共用：托盘图标（左键 / 菜单）与小窗右上角的
/// 「放大」。小窗开着就先收掉、主窗口藏着的就还原；restore 标志留给
/// 主窗口的轮询把设置里的开关同步回关。
pub fn reveal_main(app: &AppHandle) {
    use std::sync::atomic::Ordering;
    let state = app.state::<MiniState>();
    state.restore_requested.store(true, Ordering::Relaxed);
    let config = {
        let mut guard = state.config.lock().unwrap();
        match guard.as_ref() {
            Some(current) => {
                let next = MiniConfig { enabled: false, ..current.clone() };
                *guard = Some(next.clone());
                next
            }
            // 配置还没从主窗口推过来（刚启动就点了托盘）：直接把主窗口亮出来
            None => {
                crate::show_main_window(app);
                return;
            }
        }
    };
    apply_windows(app, &config);
    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        let _ = main.set_focus();
    }
}

/// 小窗右上角的「放大」：主窗口立刻还原、小窗立刻收掉，配置翻回关；
/// restore 标志留给主窗口的轮询去消费，把设置里的开关同步回关。
/// 窗口操作在这里直接做——主窗口要马上回来，等不了被节流的轮询。
#[tauri::command]
pub async fn mini_request_restore(app: AppHandle) {
    reveal_main(&app);
}

/// 前端来取「快捷键 / 放大按钮按过了」这两个标志：取走即清
#[derive(Clone, serde::Serialize)]
pub struct MiniEvents {
    pub toggle: bool,
    pub restore: bool,
}

#[tauri::command]
pub fn mini_take_events(app: AppHandle) -> MiniEvents {
    use std::sync::atomic::Ordering;
    let state = app.state::<MiniState>();
    let toggle = state.toggle_requested.swap(false, Ordering::Relaxed);
    let restore = state.restore_requested.swap(false, Ordering::Relaxed);
    MiniEvents { toggle, restore }
}

/// 鼠标离开小窗的即时隐藏（前端 mouseleave 触发，不等下一拍轮询）
#[tauri::command]
pub async fn mini_hide_now(app: AppHandle) {
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        let _ = mini.hide();
    }
}

/// 尺寸落盘：数据目录里的 mini-size.json，两个数一行
fn save_size_file(app: &AppHandle, size: (f64, f64)) {
    let path = app.state::<MiniState>().size_file.lock().unwrap().clone();
    let Some(path) = path else {
        log("save_size_file：size_file 未初始化，跳过".into());
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    match std::fs::write(&path, format!("{} {}", size.0, size.1)) {
        Ok(()) => log(format!("save_size_file：已写 {path:?}")),
        Err(err) => log(format!("save_size_file：写 {path:?} 失败：{err}")),
    }
}

/// 读回落盘的尺寸。内容对不上就当没有
fn load_size_file(path: &Option<PathBuf>) -> Option<(f64, f64)> {
    let path = path.as_ref()?;
    let text = std::fs::read_to_string(path).ok()?;
    let mut numbers = text.split_whitespace().filter_map(|part| part.parse::<f64>().ok());
    let width = numbers.next()?;
    let height = numbers.next()?;
    Some(clamp_size(Some(width), Some(height)))
}

/// 诊断日志。不要换成 eprintln!：GUI 子系统下没有控制台，stderr 句柄无效，
/// eprintln 会当场 panic 把整个 command 炸掉（踩过）。
/// 依次尝试 TEMP、exe 旁边：TEMP 可能指向不存在的目录（比如从 bash 启动时
/// 是 /tmp），create 只建文件不建父目录，会静默失败（踩过）。
pub(crate) fn log(message: String) {
    use std::io::Write;
    let mut path = std::env::temp_dir().join("mionovel-mini.log");
    if !std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map(|mut f| f.write_all(format!("{message}
").as_bytes()).is_ok())
        .unwrap_or(false)
    {
        if let Some(dir) = std::env::current_exe().ok().and_then(|exe| exe.parent().map(PathBuf::from)) {
            path = dir.join("mionovel-mini.log");
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
                let _ = writeln!(file, "{message}");
            }
        }
    }
}

/// Windows：悬浮显影不能抢焦点。show() 在 Windows 上是 SW_SHOW（会激活），
/// 补上 WS_EX_NOACTIVATE 之后 ShowWindow 不再激活，鼠标滚轮照常滚给
/// 悬停的那个窗口（Win10 起），点击也照常送达——前台窗口全程不动。
/// WS_EX_TOOLWINDOW 让它不出现在 Alt-Tab 里（skip_taskbar 管不到那个）。
#[cfg(windows)]
fn make_noactivate(window: &WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(hwnd.0);
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(
            hwnd,
            GWL_EXSTYLE,
            style | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize,
        );
    }
}
