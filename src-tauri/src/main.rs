// Release builds are GUI programs: without this, Windows opens a console
// window behind the app. Debug builds keep the console for log output.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    app_lib::run();
}
