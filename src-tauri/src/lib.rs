use tauri::Manager;

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
        .setup(|app| {
            // Keep the WebView profile outside the installation directory.
            // The identifier and profile path must remain stable across updates.
            let profile = app.path().app_local_data_dir()?.join("webview");
            std::fs::create_dir_all(&profile)?;
            let config = app
                .config()
                .app
                .windows
                .first()
                .ok_or("Missing main window")?;
            tauri::WebviewWindowBuilder::from_config(app, config)?
                .data_directory(profile)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Unable to start WinProgMan");
}
