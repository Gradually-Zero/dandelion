use std::sync::Mutex;

use crate::ddl::conf::{ConfigError, DdlConf};
use tauri::{
    AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Runtime, Size,
    WebviewWindow, Window, WindowEvent,
};

const DEFAULT_WINDOW_WIDTH: f64 = 1200.0;
const DEFAULT_WINDOW_HEIGHT: f64 = 800.0;

pub struct WindowStateTracker {
    // 窗口最大化时，仍然要记住最后一次普通状态下的 bounds
    // 这样从最大化还原，或重启应用后恢复窗口时，尺寸才会合理。
    last_normal_bounds: Mutex<Option<WindowBounds>>,
}

impl WindowStateTracker {
    pub fn new() -> Self {
        Self {
            last_normal_bounds: Mutex::new(None),
        }
    }

    fn set_last_normal_bounds(&self, bounds: WindowBounds) {
        if let Ok(mut last_normal_bounds) = self.last_normal_bounds.lock() {
            *last_normal_bounds = Some(bounds);
        }
    }

    fn last_normal_bounds(&self) -> Option<WindowBounds> {
        self.last_normal_bounds
            .lock()
            .ok()
            .and_then(|last_normal_bounds| *last_normal_bounds)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct WindowBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl WindowBounds {
    fn from_conf(conf: &DdlConf) -> Option<Self> {
        Some(Self {
            x: conf.window_x?,
            y: conf.window_y?,
            width: conf.window_width?,
            height: conf.window_height?,
        })
    }

    fn centered_on(monitor: &Monitor, width: f64, height: f64) -> Self {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        let x = monitor_position.x as f64 + ((monitor_size.width as f64 - width) / 2.0);
        let y = monitor_position.y as f64 + ((monitor_size.height as f64 - height) / 2.0);

        Self {
            x: x.round(),
            y: y.round(),
            width,
            height,
        }
    }

    fn intersects_monitor(&self, monitor: &Monitor) -> bool {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();
        rects_intersect(
            *self,
            Rect {
                x: monitor_position.x as f64,
                y: monitor_position.y as f64,
                width: monitor_size.width as f64,
                height: monitor_size.height as f64,
            },
        )
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Copy)]
struct ResolvedWindowState {
    bounds: WindowBounds,
    maximized: bool,
}

pub fn restore_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| tauri::Error::AssetNotFound("main".into()))?;
    let conf = DdlConf::load(app).map_err(|error| {
        let setup_error: Box<dyn std::error::Error> = Box::new(error);
        tauri::Error::Setup(setup_error.into())
    })?;
    let resolved_state = resolve_window_state(&window, &conf)?;

    apply_window_bounds(&window, resolved_state.bounds)?;
    window.show()?;

    if resolved_state.maximized {
        window.maximize()?;
    }

    app.state::<WindowStateTracker>()
        .set_last_normal_bounds(resolved_state.bounds);

    Ok(())
}

pub fn handle_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    match event {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
            // 参考 VS Code 的行为：拖动或缩放时只在内存里更新最新的普通状态 bounds
            // 避免每个窗口变化事件都去写配置文件。
            let _ = update_last_normal_bounds(window);
        }
        WindowEvent::Focused(false)
        | WindowEvent::CloseRequested { .. }
        | WindowEvent::Destroyed => {
            // 改为在生命周期的关键节点持久化，而不是每次几何变化都落盘。
            let _ = sync_window_state(window);
        }
        _ => {}
    }
}

pub fn persist_main_window_state<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = sync_webview_window_state(&window);
    }
}

fn sync_window_state<R: Runtime>(window: &Window<R>) -> Result<(), ConfigError> {
    let app = window.app_handle();
    let tracker = app.state::<WindowStateTracker>();
    let is_maximized = window.is_maximized().map_err(ConfigError::from_display)?;

    let bounds = if is_maximized {
        // 最大化时继续使用最后一次普通状态的 bounds
        // 避免把最大化后的外框尺寸错误地保存成“还原后的大小”。
        tracker.last_normal_bounds()
    } else {
        let bounds = read_window_bounds(window)?;
        tracker.set_last_normal_bounds(bounds);
        Some(bounds)
    };

    let mut conf = DdlConf::load(&app)?;
    if let Some(bounds) = bounds {
        conf.window_x = Some(bounds.x);
        conf.window_y = Some(bounds.y);
        conf.window_width = Some(bounds.width);
        conf.window_height = Some(bounds.height);
    }
    conf.window_maximized = is_maximized;
    conf.save_silent(&app)
}

fn sync_webview_window_state<R: Runtime>(window: &WebviewWindow<R>) -> Result<(), ConfigError> {
    let app = window.app_handle();
    let tracker = app.state::<WindowStateTracker>();
    let is_maximized = window.is_maximized().map_err(ConfigError::from_display)?;

    let bounds = if is_maximized {
        tracker.last_normal_bounds()
    } else {
        let bounds = read_webview_window_bounds(window)?;
        tracker.set_last_normal_bounds(bounds);
        Some(bounds)
    };

    let mut conf = DdlConf::load(&app)?;
    if let Some(bounds) = bounds {
        conf.window_x = Some(bounds.x);
        conf.window_y = Some(bounds.y);
        conf.window_width = Some(bounds.width);
        conf.window_height = Some(bounds.height);
    }
    conf.window_maximized = is_maximized;
    conf.save_silent(&app)
}

fn update_last_normal_bounds<R: Runtime>(window: &Window<R>) -> Result<(), ConfigError> {
    if window.is_maximized().map_err(ConfigError::from_display)? {
        return Ok(());
    }

    let bounds = read_window_bounds(window)?;
    window
        .app_handle()
        .state::<WindowStateTracker>()
        .set_last_normal_bounds(bounds);
    Ok(())
}

fn resolve_window_state<R: Runtime>(
    window: &WebviewWindow<R>,
    conf: &DdlConf,
) -> tauri::Result<ResolvedWindowState> {
    let primary_monitor = get_primary_monitor(window)?;
    let default_bounds = WindowBounds::centered_on(
        &primary_monitor,
        DEFAULT_WINDOW_WIDTH,
        DEFAULT_WINDOW_HEIGHT,
    );

    let bounds = match WindowBounds::from_conf(conf) {
        // 如果上次所在的显示器已经不存在了，就回退到默认居中位置，
        // 而不是把窗口恢复到屏幕外。
        Some(saved_bounds) if is_bounds_visible(window, saved_bounds)? => saved_bounds,
        _ => default_bounds,
    };

    Ok(ResolvedWindowState {
        bounds,
        maximized: conf.window_maximized,
    })
}

fn get_primary_monitor<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<Monitor> {
    window
        .primary_monitor()?
        .or_else(|| {
            window
                .available_monitors()
                .ok()
                .and_then(|mut monitors| monitors.pop())
        })
        .ok_or_else(|| tauri::Error::AssetNotFound("primary monitor".into()))
}

fn is_bounds_visible<R: Runtime>(
    window: &WebviewWindow<R>,
    bounds: WindowBounds,
) -> tauri::Result<bool> {
    let monitors = window.available_monitors()?;
    Ok(monitors
        .iter()
        .any(|monitor| bounds.intersects_monitor(monitor)))
}

fn read_window_bounds<R: Runtime>(window: &Window<R>) -> Result<WindowBounds, ConfigError> {
    let position = window.outer_position().map_err(ConfigError::from_display)?;
    let size = window.outer_size().map_err(ConfigError::from_display)?;

    Ok(WindowBounds {
        x: position.x as f64,
        y: position.y as f64,
        width: size.width as f64,
        height: size.height as f64,
    })
}

fn read_webview_window_bounds<R: Runtime>(
    window: &WebviewWindow<R>,
) -> Result<WindowBounds, ConfigError> {
    let position = window.outer_position().map_err(ConfigError::from_display)?;
    let size = window.outer_size().map_err(ConfigError::from_display)?;

    Ok(WindowBounds {
        x: position.x as f64,
        y: position.y as f64,
        width: size.width as f64,
        height: size.height as f64,
    })
}

fn apply_window_bounds<R: Runtime>(
    window: &WebviewWindow<R>,
    bounds: WindowBounds,
) -> tauri::Result<()> {
    window.set_size(Size::Physical(PhysicalSize {
        width: bounds.width.max(1.0).round() as u32,
        height: bounds.height.max(1.0).round() as u32,
    }))?;
    window.set_position(Position::Physical(PhysicalPosition {
        x: bounds.x.round() as i32,
        y: bounds.y.round() as i32,
    }))?;
    Ok(())
}

fn rects_intersect(a: WindowBounds, b: Rect) -> bool {
    let a_left = a.x;
    let a_top = a.y;
    let a_right = a.x + a.width;
    let a_bottom = a.y + a.height;

    let b_left = b.x;
    let b_top = b.y;
    let b_right = b.x + b.width;
    let b_bottom = b.y + b.height;

    a_left < b_right && a_right > b_left && a_top < b_bottom && a_bottom > b_top
}

#[cfg(test)]
mod tests {
    use super::{rects_intersect, Rect, WindowBounds};
    use crate::ddl::conf::DdlConf;

    #[test]
    fn conf_defaults_include_window_state() {
        let conf = DdlConf::new();

        assert_eq!(conf.window_x, None);
        assert_eq!(conf.window_y, None);
        assert_eq!(conf.window_width, None);
        assert_eq!(conf.window_height, None);
        assert!(!conf.window_maximized);
    }

    #[test]
    fn amend_backfills_missing_window_fields() {
        let conf = DdlConf::new()
            .amend(serde_json::json!({
                "selected_file_path": "foo.md",
                "window_x": 10.0,
                "window_y": 20.0,
                "window_width": 1200.0,
                "window_height": 800.0,
                "window_maximized": true
            }))
            .expect("amend should succeed");

        assert_eq!(conf.selected_file_path, "foo.md");
        assert_eq!(conf.window_x, Some(10.0));
        assert_eq!(conf.window_y, Some(20.0));
        assert_eq!(conf.window_width, Some(1200.0));
        assert_eq!(conf.window_height, Some(800.0));
        assert!(conf.window_maximized);
    }

    #[test]
    fn rect_intersection_detects_visible_window() {
        let bounds = WindowBounds {
            x: 100.0,
            y: 100.0,
            width: 1200.0,
            height: 800.0,
        };

        let visible_monitor = Rect {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };

        let offscreen_monitor = Rect {
            x: 3000.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        };

        assert!(rects_intersect(bounds, visible_monitor));
        assert!(!rects_intersect(bounds, offscreen_monitor));
    }
}
