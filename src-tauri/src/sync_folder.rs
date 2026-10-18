//! Sync folder (usually inside OneDrive) and local backups. The WebView never
//! gets general file access: it can only list, read and write the fixed file
//! name patterns below inside the one folder the user picked.
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    thread,
    time::Duration,
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;
const KEEP_BACKUPS: usize = 14;
const CONFIG: &str = "sync-folder.txt";

fn safe_name(name: &str, prefix: &str) -> bool {
    name.len() <= 96
        && name.starts_with(prefix)
        && name.ends_with(".json")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
        && !name.contains("..")
}

fn list_files(dir: &Path, prefix: &str) -> io::Result<Vec<String>> {
    let mut names = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        if let Some(name) = entry.file_name().to_str() {
            if safe_name(name, prefix) {
                names.push(name.to_owned());
            }
        }
    }
    names.sort();
    Ok(names)
}

fn read_file(dir: &Path, name: &str) -> io::Result<Option<String>> {
    let path = dir.join(name);
    let metadata = match fs::metadata(&path) {
        Ok(m) => m,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e),
    };
    if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
        return Err(io::Error::other("File is not a regular file or too large"));
    }
    fs::read_to_string(path).map(Some)
}

/// Write to a temporary file, then rename: readers (and the cloud client) see
/// either the old or the complete new file. OneDrive may briefly hold a lock.
fn write_atomic(dir: &Path, name: &str, contents: &str) -> io::Result<()> {
    let target = dir.join(name);
    let temp = dir.join(format!("{name}.tmp"));
    let mut file = File::create(&temp)?;
    file.write_all(contents.as_bytes())?;
    file.sync_all()?;
    drop(file);
    let mut attempt = 0;
    loop {
        match fs::rename(&temp, &target) {
            Ok(()) => return Ok(()),
            Err(e) if attempt < 5 => {
                attempt += 1;
                let _ = e;
                thread::sleep(Duration::from_millis(200 * attempt));
            }
            Err(e) => {
                let _ = fs::remove_file(&temp);
                return Err(e);
            }
        }
    }
}

fn prune(dir: &Path, prefix: &str, keep: usize) -> io::Result<()> {
    let names = list_files(dir, prefix)?;
    if names.len() > keep {
        for name in &names[..names.len() - keep] {
            let _ = fs::remove_file(dir.join(name));
        }
    }
    Ok(())
}

fn check_writable(dir: &Path) -> Result<(), String> {
    if !dir.is_dir() {
        return Err("The folder does not exist.".into());
    }
    let probe = dir.join(".winprogman-write-test");
    OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&probe)
        .map_err(|e| format!("Folder is not writable: {e}"))?;
    let _ = fs::remove_file(probe);
    Ok(())
}

fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

fn configured(app: &tauri::AppHandle) -> Result<Option<PathBuf>, String> {
    match fs::read_to_string(root(app)?.join(CONFIG)) {
        Ok(text) if !text.trim().is_empty() => Ok(Some(PathBuf::from(text.trim()))),
        Ok(_) => Ok(None),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn folder(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = configured(app)?.ok_or("No sync folder is configured.")?;
    if !dir.is_dir() {
        return Err(format!(
            "The sync folder is not available: {}",
            dir.display()
        ));
    }
    Ok(dir)
}

#[tauri::command]
pub fn sync_folder_info(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(configured(&app)?.map(|p| p.display().to_string()))
}

#[tauri::command]
pub async fn choose_sync_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(picked) = app
            .dialog()
            .file()
            .set_title("Choose the sync folder (inside OneDrive)")
            .blocking_pick_folder()
        else {
            return Ok(None);
        };
        let path = picked.into_path().map_err(|e| e.to_string())?;
        check_writable(&path)?;
        fs::write(root(&app)?.join(CONFIG), path.display().to_string())
            .map_err(|e| e.to_string())?;
        Ok(Some(path.display().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn clear_sync_folder(app: tauri::AppHandle) -> Result<(), String> {
    match fs::remove_file(root(&app)?.join(CONFIG)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn sync_list(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    list_files(&folder(&app)?, "device-").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_read(app: tauri::AppHandle, name: String) -> Result<Option<String>, String> {
    if !safe_name(&name, "device-") {
        return Err("Invalid file name.".into());
    }
    read_file(&folder(&app)?, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    if !safe_name(&name, "device-") {
        return Err("Invalid file name.".into());
    }
    write_atomic(&folder(&app)?, &name, &contents).map_err(|e| e.to_string())
}

/// Local rolling backups next to the app data (never inside the sync folder).
#[tauri::command]
pub fn backup_write(app: tauri::AppHandle, name: String, contents: String) -> Result<(), String> {
    if !safe_name(&name, "backup-") {
        return Err("Invalid file name.".into());
    }
    let dir = root(&app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    write_atomic(&dir, &name, &contents).map_err(|e| e.to_string())?;
    prune(&dir, "backup-", KEEP_BACKUPS).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn backup_list(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = root(&app)?.join("backups");
    if !dir.is_dir() {
        return Ok(Vec::new());
    }
    list_files(&dir, "backup-").map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "winprogman-{label}-{}-{:?}",
            std::process::id(),
            thread::current().id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn only_expected_file_names_are_accepted() {
        assert!(safe_name("device-abc-123.json", "device-"));
        for bad in [
            "device-..\\x.json",
            "device-a/b.json",
            "device-a.json.tmp",
            "other.json",
            "device-a b.json",
            "device-..a.json",
        ] {
            assert!(!safe_name(bad, "device-"), "{bad}");
        }
        assert!(!safe_name("device-x.json", "backup-"));
    }

    #[test]
    fn write_replaces_atomically_and_ignores_temporary_files() {
        let dir = temp("write");
        write_atomic(&dir, "device-a.json", "one").unwrap();
        write_atomic(&dir, "device-a.json", "two").unwrap();
        fs::write(dir.join("device-b.json.tmp"), "partial").unwrap();
        assert_eq!(read_file(&dir, "device-a.json").unwrap().unwrap(), "two");
        assert_eq!(read_file(&dir, "device-z.json").unwrap(), None);
        assert_eq!(list_files(&dir, "device-").unwrap(), vec!["device-a.json"]);
        assert!(!dir.join("device-a.json.tmp").exists());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rejects_oversized_or_non_regular_files() {
        let dir = temp("size");
        fs::create_dir(dir.join("device-dir.json")).unwrap();
        assert!(read_file(&dir, "device-dir.json").is_err());
        assert!(list_files(&dir, "device-").unwrap().is_empty());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn keeps_only_the_newest_backups() {
        let dir = temp("prune");
        for i in 0..6 {
            write_atomic(&dir, &format!("backup-2026-01-0{i}.json"), "x").unwrap();
        }
        prune(&dir, "backup-", 3).unwrap();
        assert_eq!(
            list_files(&dir, "backup-").unwrap(),
            vec![
                "backup-2026-01-03.json",
                "backup-2026-01-04.json",
                "backup-2026-01-05.json"
            ]
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn unwritable_or_missing_folder_is_reported() {
        let dir = temp("check");
        assert!(check_writable(&dir).is_ok());
        assert!(check_writable(&dir.join("missing")).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}
