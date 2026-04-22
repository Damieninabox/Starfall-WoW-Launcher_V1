//! Patcher core: fetches a manifest, diffs it against the install dir,
//! downloads missing/stale files with HTTP Range resume, verifies SHA-256,
//! and atomically replaces the target paths. Emits throttled progress events.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant, UNIX_EPOCH};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

pub type ProgressCallback = Arc<dyn Fn(ProgressSnapshot) + Send + Sync + 'static>;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::{Mutex, Semaphore};

use crate::fs_safety::{assert_inside, FsSafetyError};
use crate::hash_cache::{CacheEntry, HashCache};

const PARALLEL_DOWNLOADS: usize = 3;
const DOWNLOAD_CHUNK_BUF: usize = 64 * 1024;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
const MAX_HASH_RETRIES: u32 = 1;

fn cancel_flag() -> &'static Arc<AtomicBool> {
    static FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();
    FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)))
}

// ---------- errors ----------

#[derive(thiserror::Error, Debug)]
pub enum PatcherError {
    #[error("couldn't reach manifest server: {0}")]
    ManifestFetch(String),
    #[error("manifest is malformed: {0}")]
    ManifestParse(String),
    #[error("download failed for {path}: {reason}")]
    Download { path: String, reason: String },
    #[error("hash mismatch for {path} after retry — server may be corrupt")]
    HashMismatch { path: String },
    #[error("couldn't write to install folder: {0}")]
    WriteIo(String),
    #[error("install path is unsafe: {0}")]
    PathUnsafe(String),
    #[error("install root does not exist: {0}")]
    InstallRootMissing(String),
    #[error("operation cancelled by user")]
    Cancelled,
}

impl Serialize for PatcherError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<FsSafetyError> for PatcherError {
    fn from(e: FsSafetyError) -> Self {
        PatcherError::PathUnsafe(e.to_string())
    }
}

// ---------- manifest ----------

#[derive(Debug, Clone, Deserialize)]
pub struct ManifestFile {
    pub path: String,
    pub size: u64,
    pub sha256: String,
    pub url: String,
    #[serde(default)]
    pub category: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Manifest {
    #[allow(dead_code)]
    pub expansion: String,
    pub version: String,
    pub files: Vec<ManifestFile>,
    #[serde(default)]
    pub deletions: Vec<String>,
}

// ---------- work list ----------

#[derive(Debug, Clone, Copy, Serialize)]
pub enum WorkAction {
    Download,
    Replace,
    Skip,
}

#[derive(Debug, Clone)]
struct WorkItem {
    file: ManifestFile,
    action: WorkAction,
}

#[derive(Debug, Default, Serialize)]
pub struct WorkSummary {
    pub files_to_download: u32,
    pub files_to_replace: u32,
    pub files_to_skip: u32,
    pub files_to_delete: u32,
    pub bytes_total: u64,
    pub manifest_version: String,
}

// ---------- progress ----------

#[derive(Clone)]
struct ProgressHandle {
    overall_done: Arc<AtomicU64>,
    overall_total: Arc<AtomicU64>,
    file_done: Arc<AtomicU64>,
    file_total: Arc<AtomicU64>,
    current_file: Arc<Mutex<String>>,
    status: Arc<Mutex<String>>,
}

impl ProgressHandle {
    fn new(total: u64) -> Self {
        Self {
            overall_done: Arc::new(AtomicU64::new(0)),
            overall_total: Arc::new(AtomicU64::new(total)),
            file_done: Arc::new(AtomicU64::new(0)),
            file_total: Arc::new(AtomicU64::new(0)),
            current_file: Arc::new(Mutex::new(String::new())),
            status: Arc::new(Mutex::new("preparing".into())),
        }
    }

    async fn set_status(&self, s: &str) {
        *self.status.lock().await = s.to_string();
    }

    async fn set_current(&self, name: &str, total: u64) {
        *self.current_file.lock().await = name.to_string();
        self.file_done.store(0, Ordering::Release);
        self.file_total.store(total, Ordering::Release);
    }

    fn add_bytes(&self, n: u64) {
        self.file_done.fetch_add(n, Ordering::AcqRel);
        self.overall_done.fetch_add(n, Ordering::AcqRel);
    }

    async fn snapshot(&self, bytes_per_sec: u64) -> ProgressSnapshot {
        ProgressSnapshot {
            current_file: self.current_file.lock().await.clone(),
            file_bytes_done: self.file_done.load(Ordering::Acquire),
            file_bytes_total: self.file_total.load(Ordering::Acquire),
            overall_bytes_done: self.overall_done.load(Ordering::Acquire),
            overall_bytes_total: self.overall_total.load(Ordering::Acquire),
            bytes_per_sec,
            status: self.status.lock().await.clone(),
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressSnapshot {
    pub current_file: String,
    pub file_bytes_done: u64,
    pub file_bytes_total: u64,
    pub overall_bytes_done: u64,
    pub overall_bytes_total: u64,
    pub bytes_per_sec: u64,
    pub status: String,
}

// ---------- work list builder ----------

async fn hash_file_async(path: &Path) -> Result<String, PatcherError> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|e| PatcherError::WriteIo(format!("open {}: {}", path.display(), e)))?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; DOWNLOAD_CHUNK_BUF];
    loop {
        let n = file
            .read(&mut buf)
            .await
            .map_err(|e| PatcherError::WriteIo(format!("read {}: {}", path.display(), e)))?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex_lower(&hasher.finalize()))
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(&mut s, "{:02x}", b);
    }
    s
}

fn mtime_ms(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

async fn fetch_manifest(
    client: &reqwest::Client,
    url: &str,
) -> Result<Manifest, PatcherError> {
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| PatcherError::ManifestFetch(e.to_string()))?;
    if !resp.status().is_success() {
        return Err(PatcherError::ManifestFetch(format!(
            "HTTP {}",
            resp.status()
        )));
    }
    let text = resp
        .text()
        .await
        .map_err(|e| PatcherError::ManifestFetch(e.to_string()))?;
    serde_json::from_str(&text).map_err(|e| PatcherError::ManifestParse(e.to_string()))
}

async fn build_work_list(
    install_root: &Path,
    manifest: &Manifest,
    cache: &HashCache,
    force_rehash: bool,
) -> Result<Vec<WorkItem>, PatcherError> {
    let mut out = Vec::with_capacity(manifest.files.len());
    for entry in &manifest.files {
        let target = assert_inside(install_root, &entry.path)?;
        let action = decide_action(&target, entry, cache, force_rehash).await?;
        out.push(WorkItem {
            file: entry.clone(),
            action,
        });
    }
    Ok(out)
}

async fn decide_action(
    target: &Path,
    entry: &ManifestFile,
    cache: &HashCache,
    force_rehash: bool,
) -> Result<WorkAction, PatcherError> {
    let meta = match tokio::fs::metadata(target).await {
        Ok(m) => m,
        Err(_) => return Ok(WorkAction::Download),
    };
    if meta.len() != entry.size {
        return Ok(WorkAction::Replace);
    }

    let mtime = mtime_ms(
        &std::fs::metadata(target).map_err(|e| PatcherError::WriteIo(e.to_string()))?,
    );

    if !force_rehash {
        if let Some(cached) = cache.get(&entry.path, mtime, entry.size) {
            return Ok(if cached.eq_ignore_ascii_case(&entry.sha256) {
                WorkAction::Skip
            } else {
                WorkAction::Replace
            });
        }
    }

    let disk_hash = hash_file_async(target).await?;
    cache.put(
        entry.path.clone(),
        CacheEntry {
            mtime_ms: mtime,
            size: entry.size,
            sha256: disk_hash.clone(),
        },
    );
    Ok(if disk_hash.eq_ignore_ascii_case(&entry.sha256) {
        WorkAction::Skip
    } else {
        WorkAction::Replace
    })
}

// ---------- downloader ----------

async fn download_one(
    client: &reqwest::Client,
    item: &WorkItem,
    target: &Path,
    progress: &ProgressHandle,
) -> Result<(), PatcherError> {
    let partial = partial_path(target);
    if let Some(parent) = target.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
    }

    let mut last_err: Option<String> = None;
    for attempt in 0..=MAX_HASH_RETRIES {
        match do_download_attempt(client, item, &partial, progress).await {
            Ok(hash) => {
                if hash.eq_ignore_ascii_case(&item.file.sha256) {
                    atomic_replace(&partial, target).await?;
                    return Ok(());
                }
                let _ = tokio::fs::remove_file(&partial).await;
                // roll back overall progress for this file so retry re-counts cleanly
                let already = progress.file_done.swap(0, Ordering::AcqRel);
                progress
                    .overall_done
                    .fetch_sub(already, Ordering::AcqRel);
                if attempt == MAX_HASH_RETRIES {
                    return Err(PatcherError::HashMismatch {
                        path: item.file.path.clone(),
                    });
                }
                last_err = Some(format!("hash mismatch on attempt {}", attempt + 1));
            }
            Err(e) => {
                last_err = Some(e.to_string());
                if attempt == MAX_HASH_RETRIES {
                    return Err(e);
                }
                let already = progress.file_done.swap(0, Ordering::AcqRel);
                progress
                    .overall_done
                    .fetch_sub(already, Ordering::AcqRel);
            }
        }
    }
    Err(PatcherError::Download {
        path: item.file.path.clone(),
        reason: last_err.unwrap_or_else(|| "unknown".into()),
    })
}

async fn do_download_attempt(
    client: &reqwest::Client,
    item: &WorkItem,
    partial: &Path,
    progress: &ProgressHandle,
) -> Result<String, PatcherError> {
    let existing_size = tokio::fs::metadata(partial)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let mut hasher = Sha256::new();
    if existing_size > 0 && existing_size < item.file.size {
        let mut f = tokio::fs::File::open(partial)
            .await
            .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
        let mut buf = vec![0u8; DOWNLOAD_CHUNK_BUF];
        loop {
            let n = f
                .read(&mut buf)
                .await
                .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        progress.add_bytes(existing_size);
    } else if existing_size >= item.file.size {
        // partial bigger than expected → start over
        let _ = tokio::fs::remove_file(partial).await;
    }

    let resume_from = tokio::fs::metadata(partial)
        .await
        .map(|m| m.len())
        .unwrap_or(0);

    let mut req = client.get(&item.file.url);
    if resume_from > 0 {
        req = req.header(reqwest::header::RANGE, format!("bytes={}-", resume_from));
    }
    let resp = req
        .send()
        .await
        .map_err(|e| PatcherError::Download {
            path: item.file.path.clone(),
            reason: e.to_string(),
        })?;
    if !resp.status().is_success() {
        return Err(PatcherError::Download {
            path: item.file.path.clone(),
            reason: format!("HTTP {}", resp.status()),
        });
    }

    let mut file = tokio::fs::OpenOptions::new()
        .create(true)
        .append(resume_from > 0)
        .write(true)
        .truncate(resume_from == 0)
        .open(partial)
        .await
        .map_err(|e| PatcherError::WriteIo(e.to_string()))?;

    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancel_flag().load(Ordering::Acquire) {
            file.flush().await.ok();
            return Err(PatcherError::Cancelled);
        }
        let bytes = chunk.map_err(|e| PatcherError::Download {
            path: item.file.path.clone(),
            reason: e.to_string(),
        })?;
        file.write_all(&bytes)
            .await
            .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
        hasher.update(&bytes);
        progress.add_bytes(bytes.len() as u64);
    }
    file.flush()
        .await
        .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
    drop(file);
    Ok(hex_lower(&hasher.finalize()))
}

fn partial_path(target: &Path) -> PathBuf {
    let mut s = target.as_os_str().to_os_string();
    s.push(".partial");
    PathBuf::from(s)
}

async fn atomic_replace(from: &Path, to: &Path) -> Result<(), PatcherError> {
    if tokio::fs::metadata(to).await.is_ok() {
        tokio::fs::remove_file(to)
            .await
            .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
    }
    tokio::fs::rename(from, to)
        .await
        .map_err(|e| PatcherError::WriteIo(e.to_string()))
}

// ---------- progress emitter ----------

fn spawn_emitter(
    callback: ProgressCallback,
    progress: ProgressHandle,
    stop: Arc<tokio::sync::Notify>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut last_bytes = 0u64;
        let mut last_instant = Instant::now();
        loop {
            tokio::select! {
                _ = tokio::time::sleep(PROGRESS_INTERVAL) => {
                    let now = Instant::now();
                    let bytes = progress.overall_done.load(Ordering::Acquire);
                    let elapsed = now.duration_since(last_instant).as_secs_f64().max(0.001);
                    let delta = bytes.saturating_sub(last_bytes);
                    let bps = (delta as f64 / elapsed) as u64;
                    last_bytes = bytes;
                    last_instant = now;
                    let snap = progress.snapshot(bps).await;
                    callback(snap);
                }
                _ = stop.notified() => {
                    let snap = progress.snapshot(0).await;
                    callback(snap);
                    break;
                }
            }
        }
    })
}

// ---------- public commands ----------

#[tauri::command]
pub async fn patcher_check(
    install_dir: String,
    manifest_url: String,
) -> Result<WorkSummary, PatcherError> {
    let install_root = ensure_root(&install_dir).await?;
    let client = build_client()?;
    let manifest = fetch_manifest(&client, &manifest_url).await?;
    let cache = HashCache::load_default();
    let items = build_work_list(&install_root, &manifest, &cache, false).await?;
    let _ = cache.save();
    Ok(summarize(&items, &manifest))
}

#[tauri::command]
pub async fn patcher_run(
    app: AppHandle,
    install_dir: String,
    manifest_url: String,
) -> Result<(), PatcherError> {
    run_inner(app, install_dir, manifest_url, false).await
}

#[tauri::command]
pub async fn patcher_repair(
    app: AppHandle,
    install_dir: String,
    manifest_url: String,
) -> Result<(), PatcherError> {
    run_inner(app, install_dir, manifest_url, true).await
}

#[tauri::command]
pub fn patcher_cancel() {
    cancel_flag().store(true, Ordering::Release);
}

async fn run_inner(
    app: AppHandle,
    install_dir: String,
    manifest_url: String,
    force_rehash: bool,
) -> Result<(), PatcherError> {
    let cb: ProgressCallback = Arc::new(move |snap| {
        let _ = app.emit("patcher:progress", &snap);
    });
    run_patch(install_dir, manifest_url, force_rehash, cb).await
}

/// Tauri-free entry point. Runs a full patch cycle against `manifest_url`,
/// writing into `install_dir`, and invokes `on_progress` periodically.
///
/// Callers that need UI emission wrap it; tests can pass a no-op closure.
pub async fn run_patch(
    install_dir: String,
    manifest_url: String,
    force_rehash: bool,
    on_progress: ProgressCallback,
) -> Result<(), PatcherError> {
    cancel_flag().store(false, Ordering::Release);
    let install_root = ensure_root(&install_dir).await?;
    let client = build_client()?;
    let manifest = fetch_manifest(&client, &manifest_url).await?;
    let cache = Arc::new(HashCache::load_default());
    let items = build_work_list(&install_root, &manifest, &cache, force_rehash).await?;

    let bytes_total: u64 = items
        .iter()
        .filter(|it| matches!(it.action, WorkAction::Download | WorkAction::Replace))
        .map(|it| it.file.size)
        .sum();

    let progress = ProgressHandle::new(bytes_total);
    progress.set_status("downloading").await;
    let stop = Arc::new(tokio::sync::Notify::new());
    let emitter = spawn_emitter(on_progress, progress.clone(), stop.clone());

    let result = do_run(&install_root, items, &manifest, &client, cache.clone(), &progress).await;

    match &result {
        Ok(()) => progress.set_status("done").await,
        Err(PatcherError::Cancelled) => progress.set_status("cancelled").await,
        Err(_) => progress.set_status("error").await,
    }
    stop.notify_one();
    let _ = emitter.await;
    let _ = cache.save();
    result
}

async fn do_run(
    install_root: &Path,
    items: Vec<WorkItem>,
    manifest: &Manifest,
    client: &reqwest::Client,
    cache: Arc<HashCache>,
    progress: &ProgressHandle,
) -> Result<(), PatcherError> {
    let sem = Arc::new(Semaphore::new(PARALLEL_DOWNLOADS));
    let mut tasks = Vec::new();

    for item in items
        .into_iter()
        .filter(|it| matches!(it.action, WorkAction::Download | WorkAction::Replace))
    {
        let target = assert_inside(install_root, &item.file.path)?;
        let permit = sem
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| PatcherError::WriteIo(e.to_string()))?;
        let client_c = client.clone();
        let progress_c = progress.clone();
        let cache_c = cache.clone();
        let item_c = item.clone();
        tasks.push(tokio::spawn(async move {
            progress_c
                .set_current(&item_c.file.path, item_c.file.size)
                .await;
            let res = download_one(&client_c, &item_c, &target, &progress_c).await;
            if res.is_ok() {
                if let Ok(meta) = std::fs::metadata(&target) {
                    cache_c.put(
                        item_c.file.path.clone(),
                        CacheEntry {
                            mtime_ms: mtime_ms(&meta),
                            size: meta.len(),
                            sha256: item_c.file.sha256.clone(),
                        },
                    );
                }
            } else {
                cache_c.forget(&item_c.file.path);
            }
            drop(permit);
            res
        }));
    }

    for t in tasks {
        match t.await {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(e),
            Err(e) => {
                return Err(PatcherError::WriteIo(format!(
                    "worker panicked: {}",
                    e
                )))
            }
        }
    }

    progress.set_status("deleting").await;
    for rel in &manifest.deletions {
        let target = match assert_inside(install_root, rel) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if tokio::fs::metadata(&target).await.is_ok() {
            if let Err(e) = tokio::fs::remove_file(&target).await {
                tracing::warn!(path = %rel, err = %e, "delete failed");
            } else {
                cache.forget(rel);
            }
        }
    }

    Ok(())
}

async fn ensure_root(install_dir: &str) -> Result<PathBuf, PatcherError> {
    let root = PathBuf::from(install_dir);
    tokio::fs::create_dir_all(&root)
        .await
        .map_err(|e| PatcherError::InstallRootMissing(format!("{}: {}", root.display(), e)))?;
    root.canonicalize()
        .map_err(|e| PatcherError::InstallRootMissing(e.to_string()))
}

fn build_client() -> Result<reqwest::Client, PatcherError> {
    reqwest::Client::builder()
        .user_agent(concat!("starfall-launcher/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| PatcherError::ManifestFetch(e.to_string()))
}

fn summarize(items: &[WorkItem], manifest: &Manifest) -> WorkSummary {
    let mut s = WorkSummary {
        manifest_version: manifest.version.clone(),
        files_to_delete: manifest.deletions.len() as u32,
        ..WorkSummary::default()
    };
    for it in items {
        match it.action {
            WorkAction::Download => {
                s.files_to_download += 1;
                s.bytes_total += it.file.size;
            }
            WorkAction::Replace => {
                s.files_to_replace += 1;
                s.bytes_total += it.file.size;
            }
            WorkAction::Skip => {
                s.files_to_skip += 1;
            }
        }
    }
    s
}
