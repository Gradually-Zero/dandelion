// 在 Windows 的发布环境中阻止额外的控制台窗口弹出，不要删除！！
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ddl;
mod window_state;
use ddl::run;

fn main() {
    tauri::Builder::default()
        .manage(window_state::WindowStateTracker::new())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 主窗口在 tauri.conf.json 里以隐藏状态启动，
            // 这样可以先恢复上次的窗口位置和大小，再显示最终状态，避免启动时闪动。
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
            run::get_editor_theme,
            run::set_selected_file,
            run::set_editor_word_wrap,
            run::set_editor_theme,
            run::get_markdown_ast,
            run::read_selected_file_content,
            run::write_selected_file_content
        ])
        // 这里先 build 再 run，是为了拿到 App 实例并监听 RunEvent，
        // 从而在应用退出时补一次窗口状态持久化。
        .build(tauri::generate_context!())
        .expect("error while building dandelion application")
        .run(|app, event| {
            // 应用退出时可能不会再触发失焦保存，
            // 因此这里额外持久化一次，和“在生命周期边缘保存”的策略保持一致。
            if matches!(event, tauri::RunEvent::Exit) {
                window_state::persist_main_window_state(app);
            }
        });
}
