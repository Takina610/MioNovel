// 发布版不弹控制台窗口（Windows GUI 子系统）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mini;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

/// 便携模式的标记文件：exe 旁边有它，数据就落在 exe 旁边的 data\ 里。
const PORTABLE_MARKER: &str = "portable.txt";
const PORTABLE_DATA_DIR: &str = "data";

/// 关窗行为的两档（设置-高级里选）。前端经 set_close_action 推过来；
/// 原生标题栏的 × 与外壳顶栏上的「关闭」（window_close）都按它执行。
const CLOSE_EXIT: &str = "exit";
const CLOSE_HIDE: &str = "hide";

const TRAY_ID: &str = "mionovel-tray";

/// 壳自己的小设置。前端是设置的唯一事实来源，这里只是执行人（小窗同款分工）。
pub struct ShellState {
    close_action: Mutex<String>,
}

impl ShellState {
    pub fn new() -> Self {
        Self {
            close_action: Mutex::new(CLOSE_EXIT.to_string()),
        }
    }
}

/// 现在该「关窗 = 藏」还是「关窗 = 退」。
///
/// 两档之外还有一条硬规矩：**小窗开着时关主窗只能藏**。小窗和托盘都指着
/// 这个进程活着，退出会把它们一起带走——用户只是合上了主窗口，
/// 不该连悬浮的小窗也一起没了。
fn should_hide_on_close(app: &AppHandle) -> bool {
    let action = app
        .state::<ShellState>()
        .close_action
        .lock()
        .unwrap()
        .clone();
    if action == CLOSE_HIDE {
        return true;
    }
    app.state::<mini::MiniState>().mini_enabled()
}

/// 关主窗（藏或退）的唯一实现。原生标题栏的 ×（CloseRequested）与
/// 外壳顶栏的「关闭」（window_close command）都落到这里。
fn handle_main_close(app: &AppHandle) {
    if should_hide_on_close(app) {
        hide_main_window(app);
        sync_tray(app);
    } else {
        // 主窗口关闭 = 整个应用退出。小窗是附属窗口，主窗口没了它不该
        // 继续存在——否则从任务栏关掉软件后小窗还悬浮着、进程也驻留
        // （踩过）。「退出主程序（包括小窗）」指的就是这一条。
        app.exit(0);
    }
}

/// 藏主窗口（托盘 / 小窗共用）。**藏完要把 WebView2 挂起**：WebView2 不会因为
/// 窗口隐藏就自己省内存——渲染进程的 JS 堆、缓存、封面纹理原样留在内存里
/// （托盘挂着 170MB+ 的原因）。`TrySuspend` 之后渲染进程降到几 MB 级。
pub fn hide_main_window(app: &AppHandle) {
    if let Some(main) = app.get_webview_window(mini::MAIN_LABEL) {
        let _ = main.hide();
    }
    trim_main_webview(app, true);
}

/// 亮主窗口。先恢复 WebView2（挂起中的页面不渲染、不跑 JS，必须 Resume；
/// 对没挂起的 WebView2 调 Resume 是无害的空操作），再显示、抢焦点。
/// 所有「主窗口要回来」的路径（托盘单击 / 托盘菜单 / 小窗放大 / 关小窗）
/// 都必须走这里，不能各自 show——漏了 Resume 就是「托盘回来后白屏卡住」。
pub fn show_main_window(app: &AppHandle) {
    trim_main_webview(app, false);
    if let Some(main) = app.get_webview_window(mini::MAIN_LABEL) {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

/// 对主窗口的 WebView2 执行挂起 / 恢复（ICoreWebView2_3，2021 年起的
/// 常青运行时都有）。with_webview 把闭包排到主线程上执行——fire-and-forget，
/// 不会等它，所以从事件循环 / command 线程调用都不会卡。旧运行时 cast 不到
/// 接口就静默放弃（没省成内存而已）。
///
/// **`WebviewWindow::hide` 只藏 tao 窗口，不碰 WebView2 控制器的 IsVisible**，
/// 而 TrySuspend 要求 WebView2 不可见——所以挂起前要在控制器上自己补
/// `SetIsVisible(false)`（恢复时对称地置回 true）。这个坑实测过：只藏窗口
/// 不动控制器，TrySuspend 当场失败，内存一分不降。
#[cfg(windows)]
pub(crate) fn trim_main_webview(app: &AppHandle, suspend: bool) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2_3;
    use webview2_com::TrySuspendCompletedHandler;
    use windows::core::Interface;

    // 标志先落：最小化轮询（mini.rs 的 poll_minimized）据此知道当前挂起态
    let state = app.state::<mini::MiniState>();
    state
        .main_trimmed
        .store(suspend, std::sync::atomic::Ordering::Relaxed);

    let Some(main) = app.get_webview_window(mini::MAIN_LABEL) else {
        return;
    };
    let _ = main.with_webview(move |webview| unsafe {
        let controller = webview.controller();
        if suspend {
            let _ = controller.SetIsVisible(false);
            if let Ok(core) = controller.CoreWebView2() {
                if let Ok(core3) = core.cast::<ICoreWebView2_3>() {
                    // 完成回调空着：挂起成没成只是省不省内存的区别，不值得等
                    let handler = TrySuspendCompletedHandler::create(Box::new(
                        |error, _done: bool| {
                            if let Err(err) = error {
                                crate::mini::log(format!("TrySuspend 失败：{err}"));
                            } else {
                                crate::mini::log("TrySuspend 成功".into());
                            }
                            Ok(())
                        },
                    ));
                    let result = core3.TrySuspend(&handler);
                    if let Err(err) = result {
                        crate::mini::log(format!("TrySuspend 调用失败：{err}"));
                    }
                }
            }
        } else {
            let _ = controller.SetIsVisible(true);
            if let Ok(core) = controller.CoreWebView2() {
                if let Ok(core3) = core.cast::<ICoreWebView2_3>() {
                    let _ = core3.Resume();
                }
            }
        }
    });
}

#[cfg(not(windows))]
pub(crate) fn trim_main_webview(app: &AppHandle, suspend: bool) {
    let state = app.state::<mini::MiniState>();
    state
        .main_trimmed
        .store(suspend, std::sync::atomic::Ordering::Relaxed);
}

/// 托盘图标的显隐：只在「关窗会藏」或「小窗开着」时才有用——用户选了
/// 「关窗即退」且没用小窗，通知区就不该常年挂一个死图标。
/// 在 build_tray、set_close_action、handle_main_close、apply_windows 之后调用。
pub fn sync_tray(app: &AppHandle) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return;
    };
    let _ = tray.set_visible(should_hide_on_close(app));
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "打开 MioNovel", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出 MioNovel", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(app.default_window_icon().expect("bundle 图标已配置").clone())
        .tooltip("MioNovel")
        .menu(&menu)
        // 左键单击 = 回到主窗口，不弹菜单（弹窗交给右键）
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => mini::reveal_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                mini::reveal_main(tray.app_handle());
            }
        })
        .build(app)?;
    sync_tray(app);
    Ok(())
}

pub fn run() {
    let portable = portable_data_dir();
    tauri::Builder::default()
        // 小窗的系统级快捷键（全局快捷键插件）。前端不碰这个插件，
        // 注册与响应都在 src/mini.rs
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // 小窗的共享状态（mini_apply 写、轮询线程读）
        .manage(mini::MiniState::new())
        .manage(ShellState::new())
        .invoke_handler(tauri::generate_handler![
            mini::mini_apply,
            mini::mini_take_events,
            mini::mini_request_restore,
            mini::mini_hide_now,
            mini::mini_ready,
            set_close_action,
            set_decorations,
            window_minimize,
            window_toggle_maximize,
            window_is_maximized,
            window_drag,
            window_close,
        ])
        .setup(move |app| {
            // 窗口配置留在 tauri.conf.json（create: false），这里取出来手动建，
            // 为的是便携模式下能往 WebView2 的用户数据目录传自定义路径——
            // 书、进度、设置全在那个目录里，配置里 dataDirectory 只能写死，
            // 而它要求相对路径（相对 %LOCALAPPDATA%），表达不了「exe 旁边」。
            let config = app
                .config()
                .app
                .windows
                .first()
                .cloned()
                .ok_or("tauri.conf.json 里缺少窗口配置")?;
            let mut builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
            if let Some(dir) = portable.clone() {
                builder = builder.data_directory(dir);
            }
            let window = builder.build()?;

            // 通知区图标：建一次，显隐交给 sync_tray。小窗与「关窗藏托盘」
            // 都靠它找回主窗口——藏起来的窗口没有别的入口
            build_tray(app.handle())?;

            // 小窗模式：轮询线程 + 设置接收入口（src/mini.rs）。
            // 数据目录要跟主窗口同一个，两个窗口共享一份 IndexedDB
            mini::start(app.handle(), portable);

            // 拦原生标题栏的关闭：按关窗行为决定「藏进托盘」还是退出。
            let handle = app.handle().clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    if should_hide_on_close(&handle) {
                        api.prevent_close();
                        hide_main_window(&handle);
                        sync_tray(&handle);
                    } else {
                        handle.exit(0);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MioNovel 桌面窗口启动失败");
}

/// 前端把「关闭窗口时」的选择推过来（设置-高级）。重复推是幂等的；
/// 不碰窗口，所以可以是同步命令。
#[tauri::command]
fn set_close_action(app: AppHandle, action: String) {
    let value = match action.as_str() {
        "hide" => CLOSE_HIDE.to_string(),
        _ => CLOSE_EXIT.to_string(),
    };
    *app.state::<ShellState>().close_action.lock().unwrap() = value;
    sync_tray(&app);
}

/// 原生标题栏的开关。非常规主题把它收掉（最小化 / 最大化 / 关闭挪进外壳
/// 顶栏，见 ui/WindowControls），普通主题还原成带边的窗口。
/// **必须 async**：窗口操作要等事件循环应答，同步 command 在主线程上跑
/// 会等死自己（见 mini_apply 上的同一条注释）。
#[tauri::command]
async fn set_decorations(app: AppHandle, visible: bool) -> Result<(), String> {
    let Some(main) = app.get_webview_window(mini::MAIN_LABEL) else {
        return Ok(());
    };
    main.set_decorations(visible).map_err(|err| err.to_string())
}

#[tauri::command]
async fn window_minimize(app: AppHandle) {
    if let Some(main) = app.get_webview_window(mini::MAIN_LABEL) {
        let _ = main.minimize();
    }
}

/// 最大化 ⇄ 还原。返回此刻是否最大化，按钮的图标（□ / ❐）跟着换。
#[tauri::command]
async fn window_toggle_maximize(app: AppHandle) -> bool {
    let Some(main) = app.get_webview_window(mini::MAIN_LABEL) else {
        return false;
    };
    if main.is_maximized().unwrap_or(false) {
        let _ = main.unmaximize();
    } else {
        let _ = main.maximize();
    }
    main.is_maximized().unwrap_or(false)
}

/// 前端轮询用：拖拽标题栏双击、Win 键贴边这类不经按钮的最大化也要跟上报。
#[tauri::command]
async fn window_is_maximized(app: AppHandle) -> bool {
    app.get_webview_window(mini::MAIN_LABEL)
        .map(|main| main.is_maximized().unwrap_or(false))
        .unwrap_or(false)
}

/// 标题栏拖动。start_dragging 进入模态循环，必须在按住左键期间调用——
/// 前端在 mousedown 里调（官方 drag region 同一套路；我们走自己的命令，
/// 免得为 plugin:window 开一整套 capability）。
#[tauri::command]
async fn window_drag(app: AppHandle) {
    if let Some(main) = app.get_webview_window(mini::MAIN_LABEL) {
        let _ = main.start_dragging();
    }
}

/// 外壳顶栏上的「关闭」。与原生 × 同一条路：按关窗行为决定藏还是退。
#[tauri::command]
async fn window_close(app: AppHandle) {
    handle_main_close(&app);
}

/// 便携检测：只看 exe 旁边有没有 portable.txt。安装版没有这个文件，
/// 数据走默认的 %LOCALAPPDATA%\<identifier>（Tauri 在 Windows 上强制指定）。
fn portable_data_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    dir.join(PORTABLE_MARKER)
        .is_file()
        .then(|| dir.join(PORTABLE_DATA_DIR))
}
