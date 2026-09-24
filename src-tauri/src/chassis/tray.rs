//! The system tray icon and its menu.
//!
//! Always present, so that a window hidden to the tray (see
//! `window::on_ready`) can be brought back and the app can always be quit.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Runtime,
};

use super::window;

const SHOW: &str = "chassis-show";
const QUIT: &str = "chassis-quit";

pub fn create<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let name = app.package_info().name.clone();

    let show = MenuItem::with_id(app, SHOW, format!("Show {name}"), true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, QUIT, format!("Quit {name}"), true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip(&name)
        .menu(&menu)
        // Left click opens the window, right click opens the menu: the
        // convention Windows users expect from a tray icon.
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            SHOW => window::reveal(app),
            QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::reveal(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}
