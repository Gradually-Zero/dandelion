// 在 Windows 的发布环境中阻止额外的控制台窗口弹出，不要删除！！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dandelion_lib::run();
}
