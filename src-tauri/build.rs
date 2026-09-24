use std::{env, path::PathBuf};

fn main() {
    let attributes = tauri_build::Attributes::new()
        // The manifest is embedded by `embed_windows_manifest` below instead,
        // so that it reaches test binaries too.
        .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest())
        .plugin(
            // The chassis is an in-app plugin (see src/chassis/mod.rs). Its
            // commands are listed here so Tauri generates `chassis:allow-*`
            // permissions for them; `chassis:default` allows all of them and
            // is granted in capabilities/chassis.json.
            "chassis",
            tauri_build::InlinedPlugin::new()
                .commands(&["get_diagnostics"])
                .default_permission(tauri_build::DefaultPermissionRule::AllowAllCommands),
        );

    tauri_build::try_build(attributes).expect("failed to run the Tauri build script");
    embed_windows_manifest();
}

/// Embeds windows-app-manifest.xml into every binary Cargo links.
///
/// Left to tauri-build, the manifest goes into the application executable
/// only. Test binaries then load Common Controls v5, which lacks functions the
/// dialog plugin imports, and `cargo test` dies with STATUS_ENTRYPOINT_NOT_FOUND
/// before a single test runs. Passing the manifest to the linker covers the
/// application and the test harnesses alike.
fn embed_windows_manifest() {
    let os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let toolchain = env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if os != "windows" || toolchain != "msvc" {
        return;
    }

    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("set by cargo"))
        .join("windows-app-manifest.xml");
    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
}
