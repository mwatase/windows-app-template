//! Structured logs on disk, so a failure on a machine nobody can see can still
//! be diagnosed afterwards.
//!
//! Files live in the app's log directory, which on Windows is
//! `%LOCALAPPDATA%\<identifier>\logs`. The active file is `app.log`; when it
//! passes `MAX_FILE_BYTES` it is renamed with a timestamp and a new one is
//! started, and only the newest `KEEP_FILES` survive. The interface writes to
//! the same files through `@tauri-apps/plugin-log`.

use tauri::{plugin::TauriPlugin, Runtime};
use tauri_plugin_log::{log::LevelFilter, RotationStrategy, Target, TargetKind, TimezoneStrategy};

/// Name of the active log file, without the `.log` extension.
pub const LOG_FILE_NAME: &str = "app";

const MAX_FILE_BYTES: u128 = 1_000_000;
const KEEP_FILES: usize = 5;

pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    let mut builder = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::LogDir {
            file_name: Some(LOG_FILE_NAME.into()),
        }))
        .max_file_size(MAX_FILE_BYTES)
        .rotation_strategy(RotationStrategy::KeepSome(KEEP_FILES))
        // Local time, because the person reading a log next to a customer's
        // bug report is matching it against the time they were told.
        .timezone_strategy(TimezoneStrategy::UseLocal)
        .level(if cfg!(debug_assertions) {
            LevelFilter::Debug
        } else {
            LevelFilter::Info
        })
        // The windowing and networking layers are chatty at debug level and
        // would bury the program's own messages.
        .level_for("tao", LevelFilter::Warn)
        .level_for("wry", LevelFilter::Warn)
        .level_for("hyper_util", LevelFilter::Warn)
        .level_for("reqwest", LevelFilter::Warn)
        .level_for("rustls", LevelFilter::Warn);

    // Release builds have no console, and forwarding every record to the
    // webview would cost IPC traffic nobody is reading. Both are for `npm run
    // dev` only.
    if cfg!(debug_assertions) {
        builder = builder
            .target(Target::new(TargetKind::Stdout))
            .target(Target::new(TargetKind::Webview));
    }

    builder.build()
}

/// Routes panics into the log before the process ends.
///
/// Release builds abort on panic (see `[profile.release]` in Cargo.toml), and
/// the default hook prints to a console a release build does not have. Without
/// this, a crash on a customer machine would leave no trace at all.
pub fn install_panic_hook() {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        log::error!("panic: {info}");
        previous(info);
    }));
}
