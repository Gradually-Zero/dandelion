use tauri::{AppHandle, Emitter, Error};

pub fn notify_selected_change(app: &AppHandle, payload: String) -> Result<(), Error> {
    app.emit("selected-change", payload)
}
