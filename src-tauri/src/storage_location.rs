//! The pointer lives at the stable application root. Profiles are only copied at
//! startup, before creating a WebView. Source profiles are never removed.
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

#[derive(Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Pointer {
    active: Option<PathBuf>,
    pending: Option<PathBuf>,
    last_error: Option<String>,
    previous: Option<PathBuf>,
    #[serde(default)]
    activation_pending: bool,
}

pub struct StorageLocation {
    root: PathBuf,
    profile: PathBuf,
    gate: Mutex<()>,
    rollback_profile: Option<PathBuf>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationInfo {
    current_path: String,
    pending_path: Option<String>,
    last_error: Option<String>,
}

fn read_pointer(root: &Path) -> Result<Pointer, String> {
    match fs::read(root.join("storage-location.json")) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|e| format!("Cannot read storage location settings: {e}")),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Pointer::default()),
        Err(e) => Err(format!("Cannot access storage location settings: {e}")),
    }
}

fn write_pointer(root: &Path, pointer: &Pointer) -> Result<(), String> {
    // Rename is atomic on the same volume; a failed write leaves the old pointer.
    let path = root.join("storage-location.json.tmp");
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&serde_json::to_vec_pretty(pointer).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(path, root.join("storage-location.json")).map_err(|e| e.to_string())
}

fn empty_directory(path: &Path) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|e| format!("Cannot access selected folder: {e}"))?;
    #[cfg(windows)]
    {
        use std::path::{Component, Prefix};
        let drive = match path.components().next() {
            Some(Component::Prefix(prefix)) => match prefix.kind() {
                Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => Some(drive),
                _ => None,
            },
            _ => None,
        }
        .ok_or("Choose a local folder; WebView data cannot be kept on a network share.")?;
        #[link(name = "kernel32")]
        extern "system" {
            fn GetDriveTypeW(root: *const u16) -> u32;
        }
        let root = [drive as u16, b':' as u16, b'\\' as u16, 0];
        if !matches!(unsafe { GetDriveTypeW(root.as_ptr()) }, 2 | 3 | 6) {
            return Err("Choose a writable local drive; network and unavailable drives cannot hold the WebView database.".into());
        }
    }
    if !path.is_dir()
        || fs::read_dir(&path)
            .map_err(|e| e.to_string())?
            .next()
            .is_some()
    {
        return Err(
            "Choose an existing, empty folder. Existing files will never be overwritten.".into(),
        );
    }
    Ok(path)
}

fn collect_files(
    root: &Path,
    relative: &Path,
    files: &mut Vec<(PathBuf, File)>,
    directories: &mut Vec<PathBuf>,
) -> io::Result<()> {
    for entry in fs::read_dir(root.join(relative))? {
        let entry = entry?;
        let child = relative.join(entry.file_name());
        let metadata = fs::symlink_metadata(entry.path())?;
        // A profile must not escape through a junction or symbolic link.
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err(io::Error::other("Profile contains a reparse point"));
            }
        }
        if metadata.file_type().is_symlink() {
            return Err(io::Error::other("Profile contains a symbolic link"));
        }
        if metadata.is_dir() {
            directories.push(child.clone());
            collect_files(root, &child, files, directories)?;
        } else if metadata.is_file() {
            let mut options = OpenOptions::new();
            options.read(true);
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                // WebView child processes can outlive the previous application.
                // Do not copy until ALL source files can be held exclusively.
                options.share_mode(0);
            }
            files.push((child, options.open(entry.path())?));
        } else {
            return Err(io::Error::other("Unsupported profile entry"));
        }
    }
    Ok(())
}

fn copy_closed_profile(source: &Path, destination: &Path) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(20);
    let (mut files, directories) = loop {
        let mut files = Vec::new();
        let mut directories = Vec::new();
        match collect_files(source, Path::new(""), &mut files, &mut directories) {
            Ok(()) => break (files, directories),
            Err(e) => {
                drop(files);
                if Instant::now() >= deadline {
                    return Err(format!("The previous WebView profile is still in use or unreadable. Close Plan B and try again. {e}"));
                }
                std::thread::sleep(Duration::from_millis(250));
            }
        }
    };
    fs::create_dir(destination).map_err(|e| e.to_string())?;
    for directory in directories {
        fs::create_dir(destination.join(directory)).map_err(|e| e.to_string())?;
    }
    // Keep every exclusive source handle until the complete copy is durable.
    for (relative, input) in &mut files {
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(destination.join(relative))
            .map_err(|e| e.to_string())?;
        let expected = input.metadata().map_err(|e| e.to_string())?.len();
        let copied = io::copy(input, &mut output).map_err(|e| e.to_string())?;
        output.sync_all().map_err(|e| e.to_string())?;
        if copied != expected {
            return Err("Profile changed during copy; original profile retained.".into());
        }
    }
    Ok(())
}

fn migrate(source: &Path, selected: &Path) -> Result<PathBuf, String> {
    let selected = empty_directory(selected)?;
    let source = fs::canonicalize(source).map_err(|e| e.to_string())?;
    if selected.starts_with(&source) || source.starts_with(&selected) {
        return Err("The new folder must be outside the current storage folder.".into());
    }
    let staging = selected.join(".winprogman-profile-pending");
    copy_closed_profile(&source, &staging)?;
    let profile = selected.join("webview");
    fs::rename(&staging, &profile).map_err(|e| e.to_string())?;
    Ok(profile)
}

impl StorageLocation {
    pub fn prepare(root: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let mut pointer = read_pointer(&root)?;
        // A crash between pointer promotion and first WebView activation must
        // not strand the user on an unverified destination.
        if pointer.activation_pending {
            let previous = pointer.previous.clone().ok_or("Interrupted storage activation has no recovery folder. Restore storage-location.json from backup before starting.")?;
            pointer.active = Some(previous);
            pointer.pending = None;
            pointer.activation_pending = false;
            pointer.last_error = Some("The previous storage change was interrupted before activation. The original data folder remains active; the copied folder has been kept.".into());
            write_pointer(&root, &pointer)?;
        }
        let profile = match &pointer.active {
            Some(path) => {
                // Never create an empty replacement for an unavailable configured profile.
                if !path.is_absolute() || !path.is_dir() {
                    return Err(format!("Configured data folder is unavailable: {}. Reconnect the drive or restore the folder before starting Plan B. No new database was created.", path.display()));
                }
                path.clone()
            }
            None => {
                let path = root.join("webview");
                fs::create_dir_all(&path).map_err(|e| e.to_string())?;
                path
            }
        };
        let mut current = profile.clone();
        let mut rollback_profile = None;
        if let Some(selected) = pointer.pending.take() {
            match migrate(&profile, &selected) {
                Ok(destination) => {
                    pointer.active = Some(destination.clone());
                    pointer.previous = Some(profile.clone());
                    pointer.activation_pending = true;
                    pointer.last_error = None;
                    // Only switch after a complete copy and committed pointer.
                    write_pointer(&root, &pointer)?;
                    current = destination;
                    rollback_profile = Some(profile.clone());
                }
                Err(error) => {
                    pointer.last_error = Some(format!("Storage change failed; the original folder remains active. {error} Any incomplete copy was kept in {} and can be inspected manually.", selected.display()));
                    write_pointer(&root, &pointer)?;
                }
            }
        }
        Ok(Self {
            root,
            profile: current,
            gate: Mutex::new(()),
            rollback_profile,
        })
    }

    pub fn profile(&self) -> &Path {
        &self.profile
    }
    pub fn finish_activation(&self) -> Result<(), String> {
        if self.rollback_profile.is_some() {
            let mut pointer = read_pointer(&self.root)?;
            pointer.activation_pending = false;
            write_pointer(&self.root, &pointer)?;
        }
        Ok(())
    }
    pub fn webview_failed(&self, reason: &str) -> String {
        let mut message = format!(
            "Cannot open the data folder in WebView: {}. {reason}",
            self.profile.display()
        );
        if let Some(previous) = &self.rollback_profile {
            let recovery = read_pointer(&self.root).and_then(|mut pointer| {
                pointer.active = Some(previous.clone());
                pointer.pending = None;
                pointer.activation_pending = false;
                pointer.last_error = Some("The new folder could not be opened by WebView. The original data folder was restored; choose a local folder and try again.".into());
                write_pointer(&self.root, &pointer)
            });
            match recovery {
                Ok(()) => message.push_str(" The original data folder has been restored. Start Plan B again."),
                Err(error) => message.push_str(&format!(" Unable to restore storage settings: {error}. The original data remains in {}. Storage settings: {}.", previous.display(), self.root.join("storage-location.json").display())),
            }
        } else {
            message.push_str(
                " No new database was created. Reconnect or restore this folder before restarting.",
            );
        }
        message
    }
    fn info(&self) -> Result<LocationInfo, String> {
        let pointer = read_pointer(&self.root)?;
        Ok(LocationInfo {
            current_path: self.profile.display().to_string(),
            pending_path: pointer.pending.map(|p| p.display().to_string()),
            last_error: pointer.last_error,
        })
    }
}

#[tauri::command]
pub fn storage_location_info(state: State<'_, StorageLocation>) -> Result<LocationInfo, String> {
    state.info()
}

#[tauri::command]
pub async fn choose_storage_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.dialog()
            .file()
            .set_title("Choose an empty folder for Plan B data")
            .blocking_pick_folder()
            .map(|p| {
                p.into_path()
                    .map_err(|e| e.to_string())
                    .and_then(|p| empty_directory(&p))
                    .map(|p| p.display().to_string())
            })
            .transpose()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn schedule_storage_location(
    path: String,
    state: State<'_, StorageLocation>,
) -> Result<LocationInfo, String> {
    let _guard = state.gate.lock().map_err(|e| e.to_string())?;
    let path = empty_directory(Path::new(&path))?;
    let source = fs::canonicalize(&state.profile).map_err(|e| e.to_string())?;
    if path.starts_with(&source) || source.starts_with(&path) {
        return Err("The new folder must be outside the current storage folder.".into());
    }
    // Check write access without touching any existing file.
    let probe = path.join(".winprogman-write-test");
    let file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|e| format!("Folder is not writable: {e}"))?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    fs::remove_file(&probe).map_err(|e| e.to_string())?;
    let mut pointer = read_pointer(&state.root)?;
    pointer.pending = Some(path);
    pointer.last_error = None;
    write_pointer(&state.root, &pointer)?;
    state.info()
}

#[tauri::command]
pub fn cancel_storage_location(state: State<'_, StorageLocation>) -> Result<LocationInfo, String> {
    let _guard = state.gate.lock().map_err(|e| e.to_string())?;
    let mut pointer = read_pointer(&state.root)?;
    pointer.pending = None;
    write_pointer(&state.root, &pointer)?;
    state.info()
}

#[tauri::command]
pub fn restart_for_storage_location(app: tauri::AppHandle) {
    app.request_restart();
}

#[cfg(test)]
mod tests {
    use super::*;
    fn workspace() -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "winprogman-storage-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }
    #[test]
    fn migration_preserves_source_and_switches_only_after_copy() {
        let root = workspace();
        let target = root.join("chosen");
        fs::create_dir(&target).unwrap();
        let app_root = root.join("app");
        let state = StorageLocation::prepare(app_root.clone()).unwrap();
        fs::create_dir(state.profile.join("IndexedDB")).unwrap();
        fs::write(state.profile.join("IndexedDB/data"), b"database bytes").unwrap();
        write_pointer(
            &app_root,
            &Pointer {
                pending: Some(target.clone()),
                ..Default::default()
            },
        )
        .unwrap();
        let next = StorageLocation::prepare(app_root.clone()).unwrap();
        assert_eq!(
            fs::read(next.profile.join("IndexedDB/data")).unwrap(),
            b"database bytes"
        );
        assert!(state.profile.join("IndexedDB/data").exists());
        assert_eq!(
            next.profile,
            fs::canonicalize(target.join("webview")).unwrap()
        );
        assert!(read_pointer(&app_root).unwrap().pending.is_none());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn nonempty_destination_keeps_original_and_reports_failure() {
        let root = workspace();
        let app_root = root.join("app");
        let old = StorageLocation::prepare(app_root.clone()).unwrap();
        let target = root.join("chosen");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("keep"), b"untouched").unwrap();
        write_pointer(
            &app_root,
            &Pointer {
                pending: Some(target.clone()),
                ..Default::default()
            },
        )
        .unwrap();
        let next = StorageLocation::prepare(app_root.clone()).unwrap();
        assert_eq!(next.profile, old.profile);
        assert!(next.info().unwrap().last_error.is_some());
        assert_eq!(fs::read(target.join("keep")).unwrap(), b"untouched");
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn missing_configured_profile_never_becomes_empty_database() {
        let root = workspace();
        write_pointer(
            &root,
            &Pointer {
                active: Some(root.join("unavailable")),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(StorageLocation::prepare(root.clone()).is_err());
        assert!(!root.join("unavailable").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn corrupt_pointer_fails_closed() {
        let root = workspace();
        fs::write(root.join("storage-location.json"), b"broken").unwrap();
        assert!(StorageLocation::prepare(root.clone()).is_err());
        assert!(!root.join("webview").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn first_webview_failure_restores_original_pointer_and_keeps_both_copies() {
        let root = workspace();
        let app_root = root.join("app");
        let old = StorageLocation::prepare(app_root.clone()).unwrap();
        fs::write(old.profile.join("data"), b"preserved").unwrap();
        let target = root.join("chosen");
        fs::create_dir(&target).unwrap();
        write_pointer(
            &app_root,
            &Pointer {
                pending: Some(target.clone()),
                ..Default::default()
            },
        )
        .unwrap();
        let migrated = StorageLocation::prepare(app_root.clone()).unwrap();
        assert!(migrated.webview_failed("test failure").contains("restored"));
        let recovered = StorageLocation::prepare(app_root.clone()).unwrap();
        assert_eq!(recovered.profile, old.profile);
        assert_eq!(fs::read(target.join("webview/data")).unwrap(), b"preserved");
        assert_eq!(fs::read(old.profile.join("data")).unwrap(), b"preserved");
        assert!(recovered.info().unwrap().last_error.is_some());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_activation_recovers_previous_profile() {
        let root = workspace();
        let app_root = root.join("app");
        let old = StorageLocation::prepare(app_root.clone()).unwrap();
        let target = root.join("chosen");
        fs::create_dir(&target).unwrap();
        write_pointer(
            &app_root,
            &Pointer {
                pending: Some(target.clone()),
                ..Default::default()
            },
        )
        .unwrap();
        let migrated = StorageLocation::prepare(app_root.clone()).unwrap();
        assert_ne!(migrated.profile, old.profile);
        let recovered = StorageLocation::prepare(app_root.clone()).unwrap();
        assert_eq!(recovered.profile, old.profile);
        assert!(target.join("webview").is_dir());
        assert!(recovered.info().unwrap().last_error.is_some());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn completed_activation_stays_active_on_next_start() {
        let root = workspace();
        let app_root = root.join("app");
        StorageLocation::prepare(app_root.clone()).unwrap();
        let target = root.join("chosen");
        fs::create_dir(&target).unwrap();
        write_pointer(
            &app_root,
            &Pointer {
                pending: Some(target),
                ..Default::default()
            },
        )
        .unwrap();
        let migrated = StorageLocation::prepare(app_root.clone()).unwrap();
        migrated.finish_activation().unwrap();
        let next = StorageLocation::prepare(app_root).unwrap();
        assert_eq!(next.profile, migrated.profile);
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(windows)]
    #[test]
    fn source_files_must_be_exclusively_available_before_copy() {
        use std::os::windows::fs::OpenOptionsExt;
        let root = workspace();
        let path = root.join("database");
        fs::write(&path, b"data").unwrap();
        let held = OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&path)
            .unwrap();
        assert!(collect_files(&root, Path::new(""), &mut vec![], &mut vec![]).is_err());
        drop(held);
        assert!(collect_files(&root, Path::new(""), &mut vec![], &mut vec![]).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}
