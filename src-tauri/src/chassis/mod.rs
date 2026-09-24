//! THE CHASSIS: the template's native plumbing. Rarely touched per program.
//!
//! Everything here is shared by every program built from the template, and
//! is packaged as an in-app Tauri plugin named `chassis`. That keeps its
//! commands, permissions and TypeScript bindings apart from the program's own
//! (in `commands/`), which is what lets a template improvement merge into an
//! existing program without colliding with that program's code.
//!
//! A program should not need to edit this module. If it seems to, that is
//! either a bug in the chassis, worth fixing here so every program gets it, or
//! a sign the chassis needs a new extension point.

pub mod diagnostics;
pub mod error;
pub mod logging;
pub mod settings;
pub mod tray;
pub mod window;

use tauri::{plugin::TauriPlugin, Wry};

/// The plugin name. Its commands are invoked as `plugin:chassis|<command>` and
/// its permissions are `chassis:*` (declared in build.rs).
pub const PLUGIN_NAME: &str = "chassis";

/// The chassis commands and the constants shared with the interface.
pub fn specta() -> tauri_specta::Builder<Wry> {
    tauri_specta::Builder::<Wry>::new()
        .plugin_name(PLUGIN_NAME)
        .commands(tauri_specta::collect_commands![
            diagnostics::get_diagnostics,
        ])
        .constant("SETTINGS_STORE_FILE", settings::STORE_FILE)
        .constant("CLOSE_TO_TRAY_KEY", settings::CLOSE_TO_TRAY_KEY)
        .constant("MAIN_WINDOW", window::MAIN_WINDOW)
}

pub fn init() -> TauriPlugin<Wry> {
    let builder = specta();

    tauri::plugin::Builder::<Wry>::new(PLUGIN_NAME)
        .invoke_handler(builder.invoke_handler())
        .setup(move |app, _api| {
            builder.mount_events(app);
            tray::create(app)?;
            Ok(())
        })
        .on_window_ready(window::on_ready)
        .build()
}
