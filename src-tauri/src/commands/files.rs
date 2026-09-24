//! DEMO: summarise a text file the user picked or dropped.
//!
//! Exercises the path every file feature takes: a path arrives from the
//! interface, is checked against the filesystem scope, is read off the UI
//! thread, and comes back as a typed result or a typed error. `npm run init`
//! deletes this file.

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

use crate::chassis::error::{AppError, CommandError};

/// Larger files are refused rather than read into memory for a preview.
const MAX_BYTES: u64 = 5 * 1024 * 1024;
const PREVIEW_CHARS: usize = 800;

#[derive(Debug, Clone, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TextFileSummary {
    pub name: String,
    pub size_bytes: u64,
    pub lines: u32,
    pub words: u32,
    pub characters: u32,
    /// The start of the file, at most `PREVIEW_CHARS` characters.
    pub preview: String,
    /// True when the preview stops before the end of the file.
    pub truncated: bool,
}

#[tauri::command]
#[specta::specta]
pub async fn inspect_text_file(
    app: AppHandle,
    path: String,
) -> Result<TextFileSummary, CommandError> {
    let path = PathBuf::from(path);

    // A command receives whatever the webview sends it. Only paths the user
    // chose, in the file dialog or by dropping them on the window, are in the
    // filesystem scope, so this check is what stops a compromised page from
    // reading arbitrary files through a command that looks harmless.
    if !app.fs_scope().is_allowed(&path) {
        return Err(AppError::not_allowed(format!(
            "{} is not in the filesystem scope",
            path.display()
        ))
        .into());
    }

    // File I/O stays off the async runtime's worker threads.
    Ok(tauri::async_runtime::spawn_blocking(move || inspect(&path)).await??)
}

fn inspect(path: &Path) -> Result<TextFileSummary, AppError> {
    let metadata = std::fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(AppError::program(
            "demo.not_a_file",
            "That is a folder, not a file.",
            format!("{} is not a regular file", path.display()),
        ));
    }
    if metadata.len() > MAX_BYTES {
        return Err(AppError::program(
            "demo.too_large",
            "That file is larger than 5 MB, which is too big to preview.",
            format!("{} is {} bytes", path.display(), metadata.len()),
        ));
    }

    let bytes = std::fs::read(path)?;
    let text = decode_text(bytes).map_err(|detail| {
        AppError::program(
            "demo.not_text",
            "That file is not plain text, so it cannot be previewed.",
            format!("{}: {detail}", path.display()),
        )
    })?;

    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(summarize(name, metadata.len(), &text))
}

/// UTF-8 text, minus a byte order mark. NUL bytes mean a binary file that
/// happens to be valid UTF-8, which would otherwise preview as garbage.
fn decode_text(bytes: Vec<u8>) -> Result<String, String> {
    let text = String::from_utf8(bytes).map_err(|error| error.to_string())?;
    if text.contains('\0') {
        return Err("contains NUL bytes".to_owned());
    }
    Ok(text
        .strip_prefix('\u{feff}')
        .map(str::to_owned)
        .unwrap_or(text))
}

fn summarize(name: String, size_bytes: u64, text: &str) -> TextFileSummary {
    let characters = text.chars().count();
    let preview: String = text.chars().take(PREVIEW_CHARS).collect();

    TextFileSummary {
        name,
        size_bytes,
        lines: saturate(text.lines().count()),
        words: saturate(text.split_whitespace().count()),
        characters: saturate(characters),
        preview,
        truncated: characters > PREVIEW_CHARS,
    }
}

fn saturate(count: usize) -> u32 {
    u32::try_from(count).unwrap_or(u32::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summarizes_counts_and_preview() {
        let summary = summarize("notes.txt".into(), 26, "one two\nthree\n\nfour five six");
        assert_eq!(summary.lines, 4);
        assert_eq!(summary.words, 6);
        assert_eq!(summary.characters, 28);
        assert!(!summary.truncated);
        assert_eq!(summary.preview, "one two\nthree\n\nfour five six");
    }

    #[test]
    fn long_text_is_truncated_on_a_character_boundary() {
        // Multi-byte characters: slicing by bytes would panic mid-character.
        let text = "é".repeat(PREVIEW_CHARS + 10);
        let summary = summarize("accents.txt".into(), text.len() as u64, &text);
        assert!(summary.truncated);
        assert_eq!(summary.preview.chars().count(), PREVIEW_CHARS);
    }

    #[test]
    fn decoding_strips_a_bom_and_rejects_binary() {
        assert_eq!(decode_text(b"\xEF\xBB\xBFhello".to_vec()).unwrap(), "hello");
        assert!(decode_text(vec![0x68, 0x00, 0x69]).is_err());
        assert!(decode_text(vec![0xff, 0xfe, 0x00]).is_err());
    }

    #[test]
    fn folders_are_refused_with_a_program_code() {
        let error = inspect(&std::env::temp_dir()).unwrap_err();
        assert_eq!(error.code(), "demo.not_a_file");
    }
}
