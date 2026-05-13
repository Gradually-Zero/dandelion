mod ddl;

use ddl::{run, window_state};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(window_state::WindowStateTracker::new())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            window_state::restore_main_window(app.handle())
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                window_state::handle_window_event(window, event);
            }
        })
        .invoke_handler(tauri::generate_handler![
            run::get_selected_file,
            run::get_editor_word_wrap,
            run::get_ui_theme,
            run::set_selected_file,
            run::set_editor_word_wrap,
            run::set_ui_theme,
            run::get_markdown_ast,
            run::read_selected_file_content,
            run::write_selected_file_content
        ])
        .build(tauri::generate_context!())
        .expect("error while building dandelion application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                window_state::persist_main_window_state(app);
            }
        });
}
