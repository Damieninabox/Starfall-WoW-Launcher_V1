//! Backup + restore the player's `WTF/` folder as a zip.

use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::Serialize;
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

use crate::fs_safety::{assert_inside, FsSafetyError};

#[derive(thiserror::Error, Debug)]
pub enum BackupError {
    #[error("install dir invalid: {0}")]
    InstallDirInvalid(String),
    #[error("no WTF folder found — have you run the game once?")]
    NothingToBackup,
    #[error("i/o error: {0}")]
    Io(String),
    #[error("zip error: {0}")]
    Zip(String),
    #[error("unsafe path: {0}")]
    PathUnsafe(String),
}

impl Serialize for BackupError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<FsSafetyError> for BackupError {
    fn from(e: FsSafetyError) -> Self {
        BackupError::PathUnsafe(e.to_string())
    }
}

fn ensure_root(install_dir: &str) -> Result<PathBuf, BackupError> {
    let p = PathBuf::from(install_dir);
    p.canonicalize()
        .map_err(|e| BackupError::InstallDirInvalid(format!("{}: {e}", p.display())))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupReport {
    pub zip_path: String,
    pub files_zipped: u32,
    pub bytes_zipped: u64,
}

#[tauri::command]
pub async fn backup_wtf(
    install_dir: String,
    out_path: String,
) -> Result<BackupReport, BackupError> {
    let root = ensure_root(&install_dir)?;
    let wtf = assert_inside(&root, "WTF")?;
    if !wtf.exists() {
        return Err(BackupError::NothingToBackup);
    }

    let out = PathBuf::from(&out_path);
    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent).map_err(|e| BackupError::Io(e.to_string()))?;
    }
    let f = File::create(&out).map_err(|e| BackupError::Io(e.to_string()))?;
    let mut zip = ZipWriter::new(f);
    let opts =
        SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut files = 0u32;
    let mut bytes = 0u64;
    for entry in WalkDir::new(&wtf).into_iter().flatten() {
        let path = entry.path();
        let rel = match path.strip_prefix(&root) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            zip.add_directory(&rel_str, opts)
                .map_err(|e| BackupError::Zip(e.to_string()))?;
        } else if entry.file_type().is_file() {
            zip.start_file(&rel_str, opts)
                .map_err(|e| BackupError::Zip(e.to_string()))?;
            let mut src = File::open(path).map_err(|e| BackupError::Io(e.to_string()))?;
            let mut buf = [0u8; 64 * 1024];
            loop {
                let n = src.read(&mut buf).map_err(|e| BackupError::Io(e.to_string()))?;
                if n == 0 {
                    break;
                }
                zip.write_all(&buf[..n])
                    .map_err(|e| BackupError::Zip(e.to_string()))?;
                bytes += n as u64;
            }
            files += 1;
        }
    }
    zip.finish().map_err(|e| BackupError::Zip(e.to_string()))?;

    Ok(BackupReport {
        zip_path: out.to_string_lossy().to_string(),
        files_zipped: files,
        bytes_zipped: bytes,
    })
}

#[tauri::command]
pub async fn restore_wtf(install_dir: String, zip_path: String) -> Result<u32, BackupError> {
    let root = ensure_root(&install_dir)?;
    let f = File::open(Path::new(&zip_path)).map_err(|e| BackupError::Io(e.to_string()))?;
    let mut archive = ZipArchive::new(f).map_err(|e| BackupError::Zip(e.to_string()))?;
    let mut restored = 0u32;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| BackupError::Zip(e.to_string()))?;
        let rel = match entry.enclosed_name() {
            Some(n) => n.to_path_buf(),
            None => continue,
        };
        let rel_str = rel.to_string_lossy().replace('\\', "/");
        if !rel_str.starts_with("WTF/") && rel_str != "WTF" {
            continue; // only restore WTF/*
        }
        let target = assert_inside(&root, &rel_str)?;
        if entry.is_dir() {
            std::fs::create_dir_all(&target).map_err(|e| BackupError::Io(e.to_string()))?;
        } else {
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent).map_err(|e| BackupError::Io(e.to_string()))?;
            }
            let mut out =
                File::create(&target).map_err(|e| BackupError::Io(e.to_string()))?;
            std::io::copy(&mut entry, &mut out).map_err(|e| BackupError::Io(e.to_string()))?;
            restored += 1;
        }
    }
    Ok(restored)
}
