// 发布版不弹控制台窗口（Windows GUI 子系统）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mini;

use std::path::PathBuf;

use tauri::Manager;

/// 便携模式的标记文件：exe 旁边有它，数据就落在 exe 旁边的 data\ 里。
const PORTABLE_MARKER: &str = "portable.txt";
const PORTABLE_DATA_DIR: &str = "data";

/// 便携检测：只看 exe 旁边有没有 portable.txt。安装版没有这个文件，
/// 数据走默认的 %LOCALAPPDATA%\<identifier>（Tauri 在 Windows 上强制指定）。
fn portable_data_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    dir.join(PORTABLE_MARKER)
        .is_file()
        .then(|| dir.join(PORTABLE_DATA_DIR))
}

pub fn run() {
    let portable = portable_data_dir();
    tauri::Builder::default()
        // 小窗的系统级快捷键（全局快捷键插件）。前端不碰这个插件，
        // 注册与响应都在 src/mini.rs
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // 小窗的共享状态（mini_apply 写、轮询线程读）
        .manage(mini::MiniState::new())
        .invoke_handler(tauri::generate_handler![
            mini::mini_apply,
            mini::mini_take_events,
            mini::mini_request_restore,
            mini::mini_hide_now,
            mini::mini_ready,
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
            builder.build()?;

            // 小窗模式：轮询线程 + 设置接收入口（src/mini.rs）。
            // 数据目录要跟主窗口同一个，两个窗口共享一份 IndexedDB
            mini::start(app.handle(), portable);

            // 主窗口关闭 = 整个应用退出。小窗是附属窗口，主窗口没了它不该
            // 继续存在——否则从任务栏关掉软件后小窗还悬浮着、进程也驻留
            // （踩过）。无框小窗没有关闭按钮，这里只拦主窗口
            let handle = app.handle().clone();
            let main = app.get_webview_window(mini::MAIN_LABEL).expect("主窗口已建");
            main.on_window_event(move |event| {
                if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                    handle.exit(0);
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MioNovel 桌面窗口启动失败");
}
