//! The main window's lifecycle: remembering where it was, bringing it back,
//! and deciding what the close button means.

use tauri::{AppHandle, Manager, Runtime, Window, WindowEvent};
use tauri_plugin_window_state::StateFlags;

use super::settings;

/// Label of the window declared in tauri.conf.json.
pub const MAIN_WINDOW: &str = "main";

/// Restores size, position and maximized state between launches.
///
/// Visibility is deliberately left out: a window last hidden to the tray
/// would otherwise start hidden, which reads as "the app did not open".
/// Decorations are left out because they are configuration, not state.
pub fn state_plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_window_state::Builder::new()
        .with_state_flags(
            StateFlags::SIZE
                | StateFlags::POSITION
                | StateFlags::MAXIMIZED
                | StateFlags::FULLSCREEN,
        )
        .build()
}

/// Brings the main window to the front, wherever it currently is: hidden to
/// the tray, minimized, or behind other windows.
pub fn reveal<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        log::warn!("reveal: there is no window labelled {MAIN_WINDOW}");
        return;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

/// Called for every window as it is created.
pub fn on_ready<R: Runtime>(window: Window<R>) {
    if window.label() != MAIN_WINDOW {
        return;
    }

    let handle = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            if settings::close_to_tray(handle.app_handle()) {
                api.prevent_close();
                if let Err(error) = handle.hide() {
                    log::error!("could not hide the main window to the tray: {error}");
                }
            }
        }
    });
}
