//! The composition root: every plugin, the chassis and the program's commands
//! assembled into one app. Owned by the template; a program's own native code
//! goes in `commands/`.

// Only debug launches and `cargo test` write the bindings; release builds
// leave the exporter out entirely.
#[cfg(any(debug_assertions, test))]
mod bindings;
// Public because it is an API: the program's commands build on its error
// types and helpers. Private, a helper the program happens not to use yet
// would trip the dead-code lint in every freshly initialised program.
pub mod chassis;
mod commands;

pub fn run() {
    chassis::logging::install_panic_hook();

    let commands = commands::specta();

    // Keeps the TypeScript bindings current while developing: `npm run dev`
    // rewrites them on launch and Vite reloads whatever imports them.
    #[cfg(debug_assertions)]
    if let Err(error) = bindings::export() {
        eprintln!("could not export the TypeScript bindings: {error}");
    }

    tauri::Builder::default()
        // Must come first. A second launch (a double-clicked shortcut, a file
        // association) is handed to the running instance, which comes to the
        // front, before anything else in the new process initialises.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            chassis::window::reveal(app);
        }))
        .plugin(chassis::logging::plugin())
        .plugin(chassis::window::state_plugin())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(chassis::init())
        .invoke_handler(commands.invoke_handler())
        .setup(move |app| {
            commands.mount_events(app);
            let package = app.package_info();
            log::info!("{} {} started", package.name, package.version);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
