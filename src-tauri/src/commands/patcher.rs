use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkSummary {
    pub files_to_download: u32,
    pub files_to_delete: u32,
    pub bytes_total: u64,
}

#[tauri::command]
pub async fn patcher_check(
    _install_dir: String,
    _manifest_url: String,
) -> Result<WorkSummary, String> {
    todo!("patcher::check — implemented in Task 3")
}

#[tauri::command]
pub async fn patcher_run(_install_dir: String, _manifest_url: String) -> Result<(), String> {
    todo!("patcher::run — implemented in Task 3")
}

#[tauri::command]
pub async fn patcher_repair(_install_dir: String, _manifest_url: String) -> Result<(), String> {
    todo!("patcher::repair — implemented in Task 3")
}
