//! Path-safety helpers. Every disk write in the patcher must go through
//! [`assert_inside`] so a malicious manifest can't trick us into writing
//! outside the configured install root.

use std::path::{Component, Path, PathBuf};

#[derive(thiserror::Error, Debug)]
pub enum FsSafetyError {
    #[error("manifest path is absolute — only relative paths allowed")]
    AbsolutePath,
    #[error("path escapes install root")]
    EscapesRoot,
    #[error("install root does not exist or is not accessible: {0}")]
    RootInaccessible(String),
}

/// Joins `rel_path` onto `root`, collapsing `.`/`..`, and guarantees the
/// result is still inside `root`. Does not require the target to exist.
///
/// Rejects: absolute paths, Windows drive prefixes, and any sequence of `..`
/// that escapes the canonicalized root.
pub fn assert_inside(root: &Path, rel_path: &str) -> Result<PathBuf, FsSafetyError> {
    let rel = Path::new(rel_path);
    if rel.is_absolute() {
        return Err(FsSafetyError::AbsolutePath);
    }

    let root_canon = root
        .canonicalize()
        .map_err(|e| FsSafetyError::RootInaccessible(e.to_string()))?;

    let mut resolved = root_canon.clone();
    for comp in rel.components() {
        match comp {
            Component::Prefix(_) | Component::RootDir => {
                return Err(FsSafetyError::AbsolutePath);
            }
            Component::CurDir => {}
            Component::ParentDir => {
                if !resolved.pop() || !resolved.starts_with(&root_canon) {
                    return Err(FsSafetyError::EscapesRoot);
                }
            }
            Component::Normal(part) => {
                resolved.push(part);
            }
        }
    }

    if !resolved.starts_with(&root_canon) {
        return Err(FsSafetyError::EscapesRoot);
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tmp_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "starfall-fs-safety-{}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn accepts_simple_subpath() {
        let root = tmp_root();
        let p = assert_inside(&root, "sub/dir/file.txt").unwrap();
        assert!(p.starts_with(root.canonicalize().unwrap()));
        assert!(p.ends_with("file.txt"));
    }

    #[test]
    fn rejects_absolute_unix() {
        let root = tmp_root();
        assert!(matches!(
            assert_inside(&root, "/etc/passwd"),
            Err(FsSafetyError::AbsolutePath)
        ));
    }

    #[test]
    fn rejects_absolute_windows() {
        let root = tmp_root();
        assert!(matches!(
            assert_inside(&root, "C:\\Windows\\System32\\cmd.exe"),
            Err(FsSafetyError::AbsolutePath)
        ));
    }

    #[test]
    fn rejects_parent_escape() {
        let root = tmp_root();
        assert!(matches!(
            assert_inside(&root, "../../outside.txt"),
            Err(FsSafetyError::EscapesRoot)
        ));
    }

    #[test]
    fn rejects_dotdot_mixed() {
        let root = tmp_root();
        assert!(matches!(
            assert_inside(&root, "a/../../b.txt"),
            Err(FsSafetyError::EscapesRoot)
        ));
    }

    #[test]
    fn normalizes_dot_segments() {
        let root = tmp_root();
        let p = assert_inside(&root, "./sub/./nested/file.txt").unwrap();
        assert!(p.ends_with("file.txt"));
        assert!(!p.to_string_lossy().contains("./"));
    }
}
