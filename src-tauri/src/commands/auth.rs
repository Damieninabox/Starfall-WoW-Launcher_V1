#[tauri::command]
pub async fn auth_login(_username: String, _password: String) -> Result<String, String> {
    todo!("auth::login — implemented in a later session")
}

#[tauri::command]
pub async fn auth_logout() -> Result<(), String> {
    todo!("auth::logout — implemented in a later session")
}
