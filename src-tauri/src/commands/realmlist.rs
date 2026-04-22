//! Read and write `Data/<locale>/realmlist.wtf`.
//!
//! Cataclysm 4.3.4 is picky about the file: UTF-8 **no BOM**, LF line endings.
//! Locale subdirs under `Data/` (enUS, deDE, frFR, ...) each need their own
//! `realmlist.wtf`, and we write to all of them so switching locale doesn't
//! silently leave the player on the wrong server.

use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::fs_safety::{assert_inside, FsSafetyError};

#[derive(thiserror::Error, Debug)]
pub enum RealmlistError {
    #[error("install folder not found or inaccessible: {0}")]
    InstallDirInvalid(String),
    #[error("no `Data/<locale>/` folder in install — is this a Cataclysm install?")]
    NoLocaleFound,
    #[error("couldn't read realmlist.wtf: {0}")]
    ReadIo(String),
    #[error("couldn't write realmlist.wtf: {0}")]
    WriteIo(String),
    #[error("unsafe path: {0}")]
    PathUnsafe(String),
}

impl Serialize for RealmlistError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<FsSafetyError> for RealmlistError {
    fn from(e: FsSafetyError) -> Self {
        RealmlistError::PathUnsafe(e.to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RealmlistState {
    pub locales: Vec<String>,
    pub server: Option<String>,
    pub paths: Vec<String>,
}

fn locale_dirs(install_root: &Path) -> Result<Vec<(String, PathBuf)>, RealmlistError> {
    let data = install_root.join("Data");
    let read = match std::fs::read_dir(&data) {
        Ok(r) => r,
        Err(e) => {
            return Err(RealmlistError::InstallDirInvalid(format!(
                "Data/ missing: {e}"
            )))
        }
    };
    let mut out = Vec::new();
    for entry in read.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        // Locale dirs are 4 letters (e.g. enUS, deDE). Skip MPQ + other dirs.
        if name.len() == 4 && name.chars().all(|c| c.is_ascii_alphabetic()) {
            out.push((name, path));
        }
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    if out.is_empty() {
        Err(RealmlistError::NoLocaleFound)
    } else {
        Ok(out)
    }
}

fn parse_realmlist(contents: &str) -> Option<String> {
    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        // Tokens: first = "set", second = "realmlist" (case-insensitive),
        // rest = server (first whitespace-separated token).
        let mut it = trimmed.split_whitespace();
        let first = it.next()?;
        if !first.eq_ignore_ascii_case("set") {
            continue;
        }
        let second = it.next()?;
        if !second.eq_ignore_ascii_case("realmlist") {
            continue;
        }
        let server = it.next()?;
        return Some(server.to_string());
    }
    None
}

fn ensure_root(install_dir: &str) -> Result<PathBuf, RealmlistError> {
    let p = PathBuf::from(install_dir);
    p.canonicalize()
        .map_err(|e| RealmlistError::InstallDirInvalid(format!("{}: {e}", p.display())))
}

#[tauri::command]
pub async fn realmlist_read(install_dir: String) -> Result<RealmlistState, RealmlistError> {
    let root = ensure_root(&install_dir)?;
    let locales = locale_dirs(&root)?;
    let mut paths = Vec::new();
    let mut server: Option<String> = None;
    for (_, dir) in &locales {
        let safe = assert_inside(
            &root,
            &format!("Data/{}/realmlist.wtf", dir.file_name().unwrap().to_string_lossy()),
        )?;
        paths.push(safe.to_string_lossy().to_string());
        if server.is_none() {
            if let Ok(contents) = std::fs::read_to_string(&safe) {
                server = parse_realmlist(&contents);
            }
        }
    }
    Ok(RealmlistState {
        locales: locales.into_iter().map(|(n, _)| n).collect(),
        server,
        paths,
    })
}

#[tauri::command]
pub async fn realmlist_write(
    install_dir: String,
    server: String,
) -> Result<RealmlistState, RealmlistError> {
    let server = server.trim().to_string();
    if server.is_empty() {
        return Err(RealmlistError::WriteIo("server is empty".into()));
    }
    let root = ensure_root(&install_dir)?;
    let locales = locale_dirs(&root)?;
    let payload = format!("set realmlist {server}\n");
    let mut paths = Vec::new();
    for (name, _) in &locales {
        let rel = format!("Data/{name}/realmlist.wtf");
        let target = assert_inside(&root, &rel)?;
        // UTF-8 no BOM + LF. We write `payload` literally — no formatter
        // touches it, so no CRLF on Windows.
        std::fs::write(&target, payload.as_bytes())
            .map_err(|e| RealmlistError::WriteIo(format!("{}: {e}", target.display())))?;
        paths.push(target.to_string_lossy().to_string());
    }
    Ok(RealmlistState {
        locales: locales.into_iter().map(|(n, _)| n).collect(),
        server: Some(server),
        paths,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch() -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "starfall-realmlist-{}-{}",
            std::process::id(),
            rand_hex()
        ));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn rand_hex() -> String {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        format!("{:x}", now)
    }

    fn with_locale(root: &Path, locale: &str) {
        fs::create_dir_all(root.join("Data").join(locale)).unwrap();
    }

    #[test]
    fn parses_set_realmlist_case_insensitive() {
        assert_eq!(
            parse_realmlist("Set Realmlist logon.starfall.gg\n"),
            Some("logon.starfall.gg".into())
        );
        assert_eq!(
            parse_realmlist("# comment\nset realmlist  logon.example\n"),
            Some("logon.example".into())
        );
        assert_eq!(parse_realmlist(""), None);
        assert_eq!(parse_realmlist("some other content"), None);
    }

    #[test]
    fn writes_lf_no_bom_to_all_locales() {
        let root = scratch();
        with_locale(&root, "enUS");
        with_locale(&root, "deDE");
        let root_s = root.to_string_lossy().to_string();

        let rt = tokio::runtime::Runtime::new().unwrap();
        let state = rt
            .block_on(realmlist_write(root_s.clone(), "logon.starfall.gg".into()))
            .unwrap();
        assert_eq!(state.paths.len(), 2);
        assert_eq!(state.server.as_deref(), Some("logon.starfall.gg"));

        for p in &state.paths {
            let bytes = fs::read(p).unwrap();
            // no BOM
            assert!(!bytes.starts_with(b"\xEF\xBB\xBF"));
            // no CR
            assert!(!bytes.contains(&b'\r'));
            assert_eq!(bytes, b"set realmlist logon.starfall.gg\n");
        }
    }

    #[test]
    fn read_returns_server_when_present() {
        let root = scratch();
        with_locale(&root, "enUS");
        fs::write(
            root.join("Data").join("enUS").join("realmlist.wtf"),
            "set realmlist old.example.com\n",
        )
        .unwrap();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let state = rt
            .block_on(realmlist_read(root.to_string_lossy().to_string()))
            .unwrap();
        assert_eq!(state.server.as_deref(), Some("old.example.com"));
        assert_eq!(state.locales, vec!["enUS"]);
    }

    #[test]
    fn errors_when_no_locale_dir() {
        let root = scratch();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let err = rt
            .block_on(realmlist_read(root.to_string_lossy().to_string()))
            .unwrap_err();
        assert!(matches!(err, RealmlistError::InstallDirInvalid(_)));
    }
}
