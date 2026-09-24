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
//! Return `Result<T, CommandError>` and use `?`. For failures specific to the
//! program, use `AppError::program(code, message, detail)` from the chassis.

mod files;

use tauri::Wry;

pub fn specta() -> tauri_specta::Builder<Wry> {
    tauri_specta::Builder::<Wry>::new()
        .commands(tauri_specta::collect_commands![files::inspect_text_file,])
        // File sizes are u64, which TypeScript can only hold exactly up to
        // 2^53 bytes (8 PiB). That is fine for sizes, and for most counters.
        .dangerously_cast_bigints_to_number()
}
