use tauri_plugin_opener::OpenerExt;

fn valid_folder_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    let drive =
        bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' && bytes[2] == b'\\';
    let unc = path.starts_with("\\\\")
        && path[2..]
            .split('\\')
            .take(2)
            .filter(|p| !p.is_empty())
            .count()
            == 2;
    if (!drive && !unc) || path.starts_with("\\\\?\\") || path.starts_with("\\\\.\\") {
        return false;
    }
    if path
        .chars()
        .any(|c| c.is_control() || "<>\"|?*".contains(c))
    {
        return false;
    }
    let remainder = if drive { &path[2..] } else { path };
    !remainder.contains(':')
}

#[tauri::command]
pub async fn open_local_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    if !valid_folder_path(&path) {
        return Err("Enter an absolute Windows folder path.".into());
    }
    let folder = std::path::PathBuf::from(&path);
    let metadata = std::fs::metadata(&folder)
        .map_err(|_| "The folder does not exist or is not accessible.".to_string())?;
    if !metadata.is_dir() {
        return Err("This destination is not a folder.".into());
    }
    app.opener()
        .open_path(path, None::<String>)
        .map_err(|_| "Unable to open this folder in Windows Explorer.".to_string())
}

#[cfg(test)]
mod tests {
    use super::valid_folder_path;

    #[test]
    fn only_regular_absolute_windows_paths_are_allowed() {
        assert!(valid_folder_path("C:\\Users\\User\\Documents\\"));
        assert!(valid_folder_path("\\\\server\\share\\folder"));
        for path in [
            "https://example.com",
            "file:///C:/Docs",
            "C:relative",
            "\\\\?\\C:\\Docs",
            "\\\\.\\pipe\\test",
            "C:\\Docs:stream",
            "C:\\bad\npath",
            "\\\\server",
        ] {
            assert!(!valid_folder_path(path), "{path}");
        }
    }
}
