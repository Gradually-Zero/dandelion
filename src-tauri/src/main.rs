// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ddl;
use ddl::run;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![run::get_selected_file, run::set_selected_file, run::get_markdown_ast])
        .run(tauri::generate_context!())
        .expect("error while running dandelion application");
}
