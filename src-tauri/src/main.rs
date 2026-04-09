// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ddl;
use ddl::run;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            run::get_selected_file,
            run::get_editor_word_wrap,
            run::get_editor_theme,
            run::set_selected_file,
            run::set_editor_word_wrap,
            run::set_editor_theme,
            run::get_markdown_ast,
            run::read_selected_file_content,
            run::write_selected_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running dandelion application");
}
