//! Spawn the game executable. No shell — ever — so a malicious `install_dir`
//! can't be weaponized into command injection.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use crate::fs_safety::{assert_inside, FsSafetyError};

#[derive(thiserror::Error, Debug)]
pub enum LaunchError {
    #[error("install folder not found: {0}")]
    InstallDirInvalid(String),
    #[error("Wow.exe not found in install folder — is this the right directory?")]
    ExecutableMissing,
    #[error("couldn't start Wow.exe: {0}")]
    SpawnFailed(String),
    #[error("unsafe path: {0}")]
    PathUnsafe(String),
}

impl Serialize for LaunchError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<FsSafetyError> for LaunchError {
    fn from(e: FsSafetyError) -> Self {
        LaunchError::PathUnsafe(e.to_string())
    }
}

fn find_executable(root: &Path) -> Result<PathBuf, LaunchError> {
    // Prefer 64-bit build on any modern Windows. Fall back to 32-bit.
    for candidate in ["Wow-64.exe", "Wow.exe"] {
        let rel = candidate;
        let path = assert_inside(root, rel)?;
        if path.is_file() {
            return Ok(path);
        }
    }
    Err(LaunchError::ExecutableMissing)
}

fn ensure_root(install_dir: &str) -> Result<PathBuf, LaunchError> {
    let p = PathBuf::from(install_dir);
    p.canonicalize()
        .map_err(|e| LaunchError::InstallDirInvalid(format!("{}: {e}", p.display())))
}

#[tauri::command]
pub async fn launch_game(
    install_dir: String,
    args: Vec<String>,
) -> Result<(), LaunchError> {
    let root = ensure_root(&install_dir)?;
    let exe = find_executable(&root)?;

    // std::process::Command takes the argv as-is — no shell interpretation.
    // Wow.exe needs to run with cwd = install_dir so it finds Data/ properly.
    let mut cmd = Command::new(&exe);
    cmd.args(&args).current_dir(&root);

    // On Windows spawn detached-ish: we don't keep Child, so stdin/stdout
    // inherit and we don't wait. The game keeps running when the launcher
    // closes because neither process is in a shared job object.
    match cmd.spawn() {
        Ok(_child) => Ok(()),
        Err(e) => Err(LaunchError::SpawnFailed(format!(
            "{}: {e}",
            exe.display()
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch() -> PathBuf {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = std::env::temp_dir()
            .join(format!("starfall-launch-{}-{:x}", std::process::id(), now));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn executable_missing_returns_friendly_error() {
        let root = scratch();
        let canon = root.canonicalize().unwrap();
        let err = find_executable(&canon).unwrap_err();
        assert!(matches!(err, LaunchError::ExecutableMissing));
    }

    #[test]
    fn prefers_wow64_over_wow32() {
        let root = scratch();
        fs::write(root.join("Wow.exe"), b"fake").unwrap();
        fs::write(root.join("Wow-64.exe"), b"fake").unwrap();
        let canon = root.canonicalize().unwrap();
        let exe = find_executable(&canon).unwrap();
        assert!(exe.file_name().unwrap().to_string_lossy().ends_with("Wow-64.exe"));
    }
}
