//! What "Copy diagnostic info" puts on the clipboard.
//!
//! When a customer reports a problem, the exchange should be one paste rather
//! than twenty questions. This gathers everything a support conversation
//! would otherwise have to ask for: which build, which Windows, which
//! WebView2, and what the app was doing just before.

use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use super::error::CommandError;
use super::logging::LOG_FILE_NAME;

/// How much of the log to include. Enough to show what led up to a failure,
/// short enough to paste into an email.
const RECENT_LOG_LINES: usize = 200;

#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostics {
    pub app_name: String,
    pub app_version: String,
    pub identifier: String,
    pub tauri_version: String,
    pub webview_version: String,
    pub os: String,
    pub arch: String,
    pub log_file: String,
    /// The last lines of the active log file, oldest first.
    pub recent_log: String,
}

#[tauri::command]
#[specta::specta]
pub async fn get_diagnostics(app: AppHandle) -> Result<Diagnostics, CommandError> {
    let package = app.package_info();
    let log_file = app
        .path()
        .app_log_dir()?
        .join(format!("{LOG_FILE_NAME}.log"));

    let path = log_file.clone();
    let recent_log =
        tauri::async_runtime::spawn_blocking(move || read_tail(&path, RECENT_LOG_LINES)).await??;

    Ok(Diagnostics {
        app_name: package.name.clone(),
        app_version: package.version.to_string(),
        identifier: app.config().identifier.clone(),
        tauri_version: tauri::VERSION.to_owned(),
        // A missing or broken WebView2 is one of the likeliest causes of a
        // report, so its absence is reported rather than treated as an error.
        webview_version: tauri::webview_version()
            .unwrap_or_else(|error| format!("unavailable ({error})")),
        os: os_info::get().to_string(),
        arch: std::env::consts::ARCH.to_owned(),
        log_file: log_file.display().to_string(),
        recent_log,
    })
}

/// The last `max_lines` lines of a file, oldest first.
///
/// A missing file is not an error: a fresh install has not logged anything
/// yet, and diagnostics must still work then.
fn read_tail(path: &Path, max_lines: usize) -> std::io::Result<String> {
    let bytes = match std::fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(String::new()),
        Err(error) => return Err(error),
    };
    Ok(tail_lines(&String::from_utf8_lossy(&bytes), max_lines))
}

fn tail_lines(text: &str, max_lines: usize) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let start = lines.len().saturating_sub(max_lines);
    lines[start..].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tail_keeps_the_newest_lines_in_order() {
        let text = (1..=10)
            .map(|n| format!("line {n}"))
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(tail_lines(&text, 3), "line 8\nline 9\nline 10");
        assert_eq!(tail_lines(&text, 50), text);
        assert_eq!(tail_lines("", 5), "");
    }

    #[test]
    fn a_missing_log_file_is_an_empty_tail() {
        let path = std::env::temp_dir().join("windows-app-template-no-such-log-file.log");
        assert_eq!(read_tail(&path, 10).unwrap(), "");
    }
}
