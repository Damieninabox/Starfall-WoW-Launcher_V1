//! End-to-end patcher tests against the local mock server at 127.0.0.1:8787.
//!
//! The tests in this file are IGNORED by default so `cargo test` stays fast
//! when the mock server is not running. Start the mock server first, then
//! run: `cargo test --test e2e -- --ignored --test-threads=1`.

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use sha2::{Digest, Sha256};
use starfall_launcher_lib::commands::patcher::{run_patch, ProgressCallback};

const MANIFEST_URL: &str = "http://127.0.0.1:8787/manifests/cata.json";

fn scratch_dir(tag: &str) -> PathBuf {
    let dir = std::env::temp_dir()
        .join("starfall-e2e")
        .join(format!("{}-{}", tag, std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn noop_cb() -> ProgressCallback {
    Arc::new(|_snap| {})
}

fn sha256_hex(path: &std::path::Path) -> String {
    let bytes = fs::read(path).unwrap();
    let mut h = Sha256::new();
    h.update(&bytes);
    let out = h.finalize();
    let mut s = String::with_capacity(out.len() * 2);
    for b in out {
        use std::fmt::Write;
        let _ = write!(&mut s, "{:02x}", b);
    }
    s
}

async fn fetch_manifest_hashes() -> Vec<(String, String, u64)> {
    let text = reqwest::get(MANIFEST_URL)
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_str(&text).unwrap();
    json["files"]
        .as_array()
        .unwrap()
        .iter()
        .map(|f| {
            (
                f["path"].as_str().unwrap().to_string(),
                f["sha256"].as_str().unwrap().to_string(),
                f["size"].as_u64().unwrap(),
            )
        })
        .collect()
}

#[tokio::test]
#[ignore]
async fn golden_path_install() {
    let dir = scratch_dir("golden");
    run_patch(
        dir.to_string_lossy().to_string(),
        MANIFEST_URL.to_string(),
        false,
        noop_cb(),
    )
    .await
    .expect("golden patch run succeeds");

    for (rel, expected_hash, expected_size) in fetch_manifest_hashes().await {
        let p = dir.join(&rel);
        assert!(p.exists(), "missing file {}", rel);
        assert_eq!(
            fs::metadata(&p).unwrap().len(),
            expected_size,
            "size mismatch for {}",
            rel
        );
        assert_eq!(
            sha256_hex(&p),
            expected_hash,
            "hash mismatch for {}",
            rel
        );
        assert!(
            !dir.join(format!("{}.partial", rel)).exists(),
            ".partial left behind for {}",
            rel
        );
    }
}

#[tokio::test]
#[ignore]
async fn repair_redownloads_deleted_file() {
    let dir = scratch_dir("repair-deleted");
    run_patch(
        dir.to_string_lossy().to_string(),
        MANIFEST_URL.to_string(),
        false,
        noop_cb(),
    )
    .await
    .unwrap();

    fs::remove_file(dir.join("test1.bin")).unwrap();

    run_patch(
        dir.to_string_lossy().to_string(),
        MANIFEST_URL.to_string(),
        true,
        noop_cb(),
    )
    .await
    .expect("repair succeeds");

    assert!(dir.join("test1.bin").exists());
    let expected = fetch_manifest_hashes()
        .await
        .into_iter()
        .find(|(p, _, _)| p == "test1.bin")
        .unwrap()
        .1;
    assert_eq!(sha256_hex(&dir.join("test1.bin")), expected);
}

#[tokio::test]
#[ignore]
async fn repair_redownloads_corrupted_file() {
    let dir = scratch_dir("repair-corrupt");
    run_patch(
        dir.to_string_lossy().to_string(),
        MANIFEST_URL.to_string(),
        false,
        noop_cb(),
    )
    .await
    .unwrap();

    // flip 16 bytes near the start
    let path = dir.join("test1.bin");
    let mut bytes = fs::read(&path).unwrap();
    for b in bytes.iter_mut().take(32).skip(16) {
        *b ^= 0xAA;
    }
    fs::write(&path, &bytes).unwrap();

    run_patch(
        dir.to_string_lossy().to_string(),
        MANIFEST_URL.to_string(),
        true,
        noop_cb(),
    )
    .await
    .expect("repair fixes corruption");

    let expected = fetch_manifest_hashes()
        .await
        .into_iter()
        .find(|(p, _, _)| p == "test1.bin")
        .unwrap()
        .1;
    assert_eq!(sha256_hex(&path), expected);
}

#[tokio::test]
#[ignore]
async fn resume_from_partial() {
    let dir = scratch_dir("resume");

    let files = fetch_manifest_hashes().await;
    let (rel, expected_hash, expected_size) = files
        .iter()
        .find(|(p, _, _)| p == "test2.bin")
        .unwrap()
        .clone();

    let url = format!("http://127.0.0.1:8787/files/{}", rel);
    let bytes = reqwest::get(&url).await.unwrap().bytes().await.unwrap();
    assert_eq!(bytes.len() as u64, expected_size);

    let partial = dir.join(format!("{}.partial", rel));
    let half = (expected_size / 2) as usize;
    fs::write(&partial, &bytes[..half]).unwrap();

    run_patch(
        dir.to_string_lossy().to_string(),
        MANIFEST_URL.to_string(),
        false,
        noop_cb(),
    )
    .await
    .expect("resume succeeds");

    let final_path = dir.join(&rel);
    assert!(final_path.exists());
    assert!(!partial.exists(), ".partial should be removed after rename");
    assert_eq!(fs::metadata(&final_path).unwrap().len(), expected_size);
    assert_eq!(sha256_hex(&final_path), expected_hash);
}

#[tokio::test]
#[ignore]
async fn invalid_manifest_url_errors_cleanly() {
    let dir = scratch_dir("bad-url");
    let err = run_patch(
        dir.to_string_lossy().to_string(),
        "http://127.0.0.1:9/does-not-exist.json".to_string(),
        false,
        noop_cb(),
    )
    .await
    .expect_err("bad URL must error");
    let msg = err.to_string();
    assert!(
        msg.to_lowercase().contains("manifest") || msg.to_lowercase().contains("reach"),
        "expected friendly manifest error, got: {msg}"
    );
}
