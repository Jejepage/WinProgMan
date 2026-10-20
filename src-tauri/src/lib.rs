use tauri::Manager;
mod local_paths;
mod storage_location;
mod sync_folder;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            storage_location::storage_location_info,
            storage_location::choose_storage_folder,
            storage_location::schedule_storage_location,
            storage_location::cancel_storage_location,
            storage_location::restart_for_storage_location,
            local_paths::open_local_folder,
            sync_folder::sync_folder_info,
            sync_folder::choose_sync_folder,
            sync_folder::clear_sync_folder,
            sync_folder::sync_list,
            sync_folder::sync_read,
            sync_folder::sync_write,
            sync_folder::backup_write,
            sync_folder::backup_list,
        ])
        .setup(|app| {
            // Keep the WebView profile outside the installation directory.
            // The identifier and profile path must remain stable across updates.
            let storage =
                storage_location::StorageLocation::prepare(app.path().app_local_data_dir()?)
                    .map_err(|error| {
                        startup_error(&error);
                        std::io::Error::other(error)
                    })?;
            let profile = storage.profile().to_owned();
            let config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("Missing main window")?;
            tauri::WebviewWindowBuilder::from_config(app, config)?
                .data_directory(profile)
                .build()
                .map_err(|error| {
                    startup_error(&storage.webview_failed(&error.to_string()));
                    error
                })?;
            storage.finish_activation().map_err(|error| {
                startup_error(&storage.webview_failed(&error));
                std::io::Error::other(error)
            })?;
            app.manage(storage);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Unable to start Plan B");
}

// Setup has no WebView yet. Show startup failures even in release builds without
// a console; do not silently open a new, empty database after a location error.
#[cfg(windows)]
fn startup_error(message: &str) {
    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(
            window: *mut std::ffi::c_void,
            text: *const u16,
            caption: *const u16,
            flags: u32,
        ) -> i32;
    }
    let text: Vec<u16> = message.encode_utf16().chain(Some(0)).collect();
    let caption: Vec<u16> = "Plan B — storage unavailable"
        .encode_utf16()
        .chain(Some(0))
        .collect();
    unsafe {
        MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x10);
    }
}

#[cfg(not(windows))]
fn startup_error(message: &str) {
    eprintln!("{message}");
}
