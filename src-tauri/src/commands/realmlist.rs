#[tauri::command]
pub async fn realmlist_read(_install_dir: String) -> Result<String, String> {
    todo!("realmlist::read — implemented in a later session")
}

#[tauri::command]
pub async fn realmlist_write(_install_dir: String, _server: String) -> Result<(), String> {
    todo!("realmlist::write — implemented in a later session")
}
