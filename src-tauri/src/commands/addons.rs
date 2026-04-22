//! Flip individual addons on/off by renaming their `.toc` files.
//! Addon id = folder name inside `Interface/AddOns/`. Disabling renames
//! every `.toc` in that folder to `.toc.disabled`; enabling reverses it.

use std::path::PathBuf;

use serde::Serialize;

use crate::fs_safety::{assert_inside, FsSafetyError};

#[derive(thiserror::Error, Debug)]
pub enum AddonError {
    #[error("install folder not found: {0}")]
    InstallDirInvalid(String),
    #[error("addon folder not found: {0}")]
    AddonMissing(String),
    #[error("i/o error: {0}")]
    Io(String),
    #[error("unsafe path: {0}")]
    PathUnsafe(String),
}

impl Serialize for AddonError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<FsSafetyError> for AddonError {
    fn from(e: FsSafetyError) -> Self {
        AddonError::PathUnsafe(e.to_string())
    }
}

fn ensure_root(install_dir: &str) -> Result<PathBuf, AddonError> {
    let p = PathBuf::from(install_dir);
    p.canonicalize()
        .map_err(|e| AddonError::InstallDirInvalid(format!("{}: {e}", p.display())))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddonToggleReport {
    pub enabled: bool,
    pub files_renamed: u32,
}

#[tauri::command]
pub async fn addon_set_enabled(
    install_dir: String,
    addon_id: String,
    enabled: bool,
) -> Result<AddonToggleReport, AddonError> {
    let root = ensure_root(&install_dir)?;
    let rel = format!("Interface/AddOns/{}", addon_id);
    let folder = assert_inside(&root, &rel)?;
    if !folder.is_dir() {
        return Err(AddonError::AddonMissing(addon_id));
    }

    let mut renamed = 0u32;
    let entries =
        std::fs::read_dir(&folder).map_err(|e| AddonError::Io(e.to_string()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        if enabled && name.ends_with(".toc.disabled") {
            let stripped = name.trim_end_matches(".disabled").to_string();
            let target = folder.join(&stripped);
            std::fs::rename(&path, &target).map_err(|e| AddonError::Io(e.to_string()))?;
            renamed += 1;
        } else if !enabled && name.ends_with(".toc") && !name.ends_with(".toc.disabled") {
            let target = folder.join(format!("{name}.disabled"));
            std::fs::rename(&path, &target).map_err(|e| AddonError::Io(e.to_string()))?;
            renamed += 1;
        }
    }

    Ok(AddonToggleReport {
        enabled,
        files_renamed: renamed,
    })
}

#[tauri::command]
pub async fn addon_list_enabled(install_dir: String) -> Result<Vec<String>, AddonError> {
    let root = ensure_root(&install_dir)?;
    let addons_dir = assert_inside(&root, "Interface/AddOns")?;
    let mut disabled = Vec::new();
    let entries = match std::fs::read_dir(&addons_dir) {
        Ok(e) => e,
        Err(_) => return Ok(Vec::new()), // no AddOns folder yet
    };
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();
        let folder_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        let subs = match std::fs::read_dir(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let mut has_toc = false;
        let mut all_disabled = true;
        for s in subs.flatten() {
            let n = s.file_name().to_string_lossy().to_string();
            if n.ends_with(".toc") && !n.ends_with(".toc.disabled") {
                has_toc = true;
                all_disabled = false;
            }
            if n.ends_with(".toc.disabled") {
                has_toc = true;
            }
        }
        if has_toc && all_disabled {
            disabled.push(folder_name);
        }
    }
    Ok(disabled)
}
