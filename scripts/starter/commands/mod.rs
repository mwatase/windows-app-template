//! THE PROGRAM'S NATIVE COMMANDS. This is app/ for the Rust side.
//!
//! Put the program's native functions here: anything the webview must not do
//! itself, such as filesystem work, OS APIs or heavy computation. Each one is a
//! `#[tauri::command]` + `#[specta::specta]` function registered below, and
//! `npm run bindings` turns the list into typed TypeScript in
//! `src/app/bindings.ts`. Changing a signature here without updating its
//! callers then fails `npm run typecheck` instead of failing on a customer's
//! machine.
//!
//! A command looks like this, in a module of its own next to this file:
//!
//! ```ignore
//! use crate::chassis::error::{AppError, CommandError};
//!
//! #[tauri::command]
//! #[specta::specta]
//! pub async fn word_count(text: String) -> Result<u32, CommandError> {
//!     if text.len() > 1_000_000 {
//!         return Err(AppError::program("words.too_long", "That text is too long to count.", "over 1 MB").into());
//!     }
//!     Ok(u32::try_from(text.split_whitespace().count()).unwrap_or(u32::MAX))
//! }
//! ```
//!
//! Return `Result<T, CommandError>` and use `?`. For failures specific to the
//! program, use `AppError::program(code, message, detail)` from the chassis.

use tauri::Wry;

pub fn specta() -> tauri_specta::Builder<Wry> {
    tauri_specta::Builder::<Wry>::new()
        .commands(tauri_specta::collect_commands![])
        // u64 values (file sizes, counters) become TypeScript numbers, exact
        // up to 2^53. Remove this if a command needs larger integers.
        .dangerously_cast_bigints_to_number()
}
