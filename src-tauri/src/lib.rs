pub mod commands;
pub mod fs_safety;
pub mod hash_cache;

use commands::{auth, backup, cache, launch, patcher, realmlist};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            auth::auth_login,
            auth::auth_login_2fa,
            auth::auth_logout,
            auth::auth_me,
            auth::auth_has_token,
            auth::cms_fetch,
            backup::backup_wtf,
            backup::restore_wtf,
            patcher::patcher_check,
            patcher::patcher_run,
            patcher::patcher_repair,
            patcher::patcher_cancel,
            realmlist::realmlist_read,
            realmlist::realmlist_write,
            cache::cache_clear,
            launch::launch_game,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
