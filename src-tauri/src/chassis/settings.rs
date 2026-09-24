//! The native side's view of the settings store.
//!
//! Settings are written by the interface (src/chassis/settings/) through
//! tauri-plugin-store. Rust and the webview share one store instance per file,
//! so a value the user just changed is visible here immediately, before it has
//! been saved to disk.
//!
//! The file and key names below are exported to TypeScript through the
//! bindings (see `chassis::specta`), so the two sides cannot drift apart.

use tauri::{AppHandle, Runtime};
use tauri_plugin_store::StoreExt;

/// The store file, relative to the app's data directory.
pub const STORE_FILE: &str = "settings.json";

/// When true, closing the main window hides it to the tray instead of quitting.
pub const CLOSE_TO_TRAY_KEY: &str = "chassis.closeToTray";

/// Reads a boolean setting, falling back to `default` when the key is missing,
/// holds something that is not a boolean, or the store cannot be opened.
///
/// A settings problem must never stop the app from closing or starting, so
/// every failure path here degrades to the default rather than erroring.
pub fn read_bool<R: Runtime>(app: &AppHandle<R>, key: &str, default: bool) -> bool {
    match app.store(STORE_FILE) {
        Ok(store) => store
            .get(key)
            .and_then(|value| value.as_bool())
            .unwrap_or(default),
        Err(error) => {
            log::warn!("could not open {STORE_FILE}, using the default for {key}: {error}");
            default
        }
    }
}

pub fn close_to_tray<R: Runtime>(app: &AppHandle<R>) -> bool {
    read_bool(app, CLOSE_TO_TRAY_KEY, false)
}
