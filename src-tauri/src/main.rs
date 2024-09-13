// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod process;
use process::ddl_try;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ddl_try::get_markdown_ast])
        .run(tauri::generate_context!())
        .expect("error while running dandelion application");
}
