// 发布版不弹控制台窗口（Windows GUI 子系统）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

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
            if let Some(dir) = portable {
                builder = builder.data_directory(dir);
            }
            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("MioNovel 桌面窗口启动失败");
}
