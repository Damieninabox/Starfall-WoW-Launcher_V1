//! Persistent SHA-256 cache at `%APPDATA%/Starfall/hash-cache.json`.
//!
//! Keyed by relative path; entries include `(mtime_ms, size, sha256)`.
//! Hash is only trusted when mtime *and* size match the on-disk file.

use std::collections::HashMap;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntry {
    pub mtime_ms: u64,
    pub size: u64,
    pub sha256: String,
}

#[derive(Default, Serialize, Deserialize)]
struct OnDisk {
    entries: HashMap<String, CacheEntry>,
}

pub struct HashCache {
    path: PathBuf,
    inner: Mutex<OnDisk>,
}

impl HashCache {
    pub fn default_path() -> PathBuf {
        let base = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .or_else(dirs_cache_fallback)
            .unwrap_or_else(|| PathBuf::from("."));
        base.join("Starfall").join("hash-cache.json")
    }

    pub fn load_default() -> Self {
        Self::load(Self::default_path())
    }

    pub fn load(path: PathBuf) -> Self {
        let inner = match std::fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
            Err(_) => OnDisk::default(),
        };
        Self {
            path,
            inner: Mutex::new(inner),
        }
    }

    pub fn get(&self, rel_path: &str, mtime_ms: u64, size: u64) -> Option<String> {
        let inner = self.inner.lock().ok()?;
        let entry = inner.entries.get(rel_path)?;
        if entry.mtime_ms == mtime_ms && entry.size == size {
            Some(entry.sha256.clone())
        } else {
            None
        }
    }

    pub fn put(&self, rel_path: String, entry: CacheEntry) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.insert(rel_path, entry);
        }
    }

    pub fn forget(&self, rel_path: &str) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.remove(rel_path);
        }
    }

    pub fn save(&self) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let inner = self
            .inner
            .lock()
            .map_err(|_| io::Error::other("hash cache mutex poisoned"))?;
        let bytes = serde_json::to_vec(&*inner)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e.to_string()))?;
        std::fs::write(&self.path, bytes)
    }
}

fn dirs_cache_fallback() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}
