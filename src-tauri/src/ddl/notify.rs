use tauri::{AppHandle, Emitter, Error, Runtime};

pub fn notify_selected_change<R: Runtime>(
    app: &AppHandle<R>,
    payload: String,
) -> Result<(), Error> {
    app.emit("selected-change", payload)
}
