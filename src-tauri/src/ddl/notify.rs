use tauri::{AppHandle, Emitter};

pub fn notify_selected_change(app: &AppHandle, payload: String) {
    app.emit("selected-change", payload).unwrap();
}
