// 发布版不弹控制台窗口（Windows GUI 子系统）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mionovel_lib::run()
}
