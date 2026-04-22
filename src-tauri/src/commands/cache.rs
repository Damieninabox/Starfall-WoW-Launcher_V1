//! Clear contents of `Cache/` and `WDB/` inside the install dir.
//!
//! Never touches `WTF/`. Every path is asserted to be inside the install
//! root so a confused caller can't hand us `C:\Windows` to wipe.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::fs_safety::{assert_inside, FsSafetyError};

const DIRS_TO_CLEAR: &[&str] = &["Cache", "WDB"];

#[derive(thiserror::Error, Debug)]
pub enum CacheError {
    #[error("install folder not found: {0}")]
    InstallDirInvalid(String),
    #[error("unsafe path: {0}")]
    PathUnsafe(String),
    #[error("i/o error while clearing cache: {0}")]
    Io(String),
}

impl Serialize for CacheError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<FsSafetyError> for CacheError {
    fn from(e: FsSafetyError) -> Self {
        CacheError::PathUnsafe(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheClearReport {
    pub bytes_freed: u64,
    pub files_removed: u32,
    pub dirs_cleared: Vec<String>,
}

fn wipe_contents(dir: &Path, report: &mut CacheClearReport) -> Result<(), CacheError> {
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return Ok(()), // nothing to clear
    };
    for entry in read.flatten() {
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.is_dir() {
            // tally sizes before removing
            for sub in walkdir::WalkDir::new(&path).into_iter().flatten() {
                if sub.file_type().is_file() {
                    if let Ok(m) = sub.metadata() {
                        report.bytes_freed += m.len();
                        report.files_removed += 1;
                    }
                }
            }
            std::fs::remove_dir_all(&path)
                .map_err(|e| CacheError::Io(format!("{}: {e}", path.display())))?;
        } else {
            report.bytes_freed += meta.len();
            report.files_removed += 1;
            std::fs::remove_file(&path)
                .map_err(|e| CacheError::Io(format!("{}: {e}", path.display())))?;
        }
    }
    Ok(())
}

fn ensure_root(install_dir: &str) -> Result<PathBuf, CacheError> {
    let p = PathBuf::from(install_dir);
    p.canonicalize()
        .map_err(|e| CacheError::InstallDirInvalid(format!("{}: {e}", p.display())))
}

#[tauri::command]
pub async fn cache_clear(install_dir: String) -> Result<CacheClearReport, CacheError> {
    let root = ensure_root(&install_dir)?;
    let mut report = CacheClearReport {
        bytes_freed: 0,
        files_removed: 0,
        dirs_cleared: Vec::new(),
    };
    for name in DIRS_TO_CLEAR {
        let safe = assert_inside(&root, name)?;
        if safe.exists() {
            wipe_contents(&safe, &mut report)?;
            report.dirs_cleared.push((*name).to_string());
        }
    }
    Ok(report)
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
            .join(format!("starfall-cache-{}-{:x}", std::process::id(), now));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn clears_cache_and_wdb_keeps_wtf() {
        let root = scratch();
        // populate Cache, WDB, WTF
        fs::create_dir_all(root.join("Cache/sub")).unwrap();
        fs::write(root.join("Cache/a.bin"), b"hello world").unwrap();
        fs::write(root.join("Cache/sub/b.bin"), b"xxxxxxxxxxxxxx").unwrap();
        fs::create_dir_all(root.join("WDB")).unwrap();
        fs::write(root.join("WDB/creature.wdb"), b"pretend-cache").unwrap();
        fs::create_dir_all(root.join("WTF/Account/STAR")).unwrap();
        fs::write(root.join("WTF/Account/STAR/config-cache.wtf"), b"keep-me").unwrap();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let report = rt
            .block_on(cache_clear(root.to_string_lossy().to_string()))
            .unwrap();

        assert!(report.bytes_freed >= 11 + 14 + 13); // "hello world" + xs + pretend-cache
        assert!(report.files_removed >= 3);
        assert_eq!(report.dirs_cleared.len(), 2);

        // Cache + WDB dirs still exist but empty
        assert!(root.join("Cache").exists());
        assert!(root.join("Cache").read_dir().unwrap().next().is_none());
        assert!(root.join("WDB").exists());
        assert!(root.join("WDB").read_dir().unwrap().next().is_none());

        // WTF untouched
        assert!(root.join("WTF/Account/STAR/config-cache.wtf").exists());
    }

    #[test]
    fn noop_when_no_cache_dirs() {
        let root = scratch();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let report = rt
            .block_on(cache_clear(root.to_string_lossy().to_string()))
            .unwrap();
        assert_eq!(report.bytes_freed, 0);
        assert_eq!(report.files_removed, 0);
        assert!(report.dirs_cleared.is_empty());
    }
}
