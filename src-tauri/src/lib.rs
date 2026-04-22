pub mod commands;
pub mod fs_safety;
pub mod hash_cache;

use commands::{addons, auth, backup, cache, launch, patcher, realmlist};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            addons::addon_set_enabled,
            addons::addon_list_enabled,
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
