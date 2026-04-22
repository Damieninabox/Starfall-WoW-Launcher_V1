//! Authentication commands. The launcher never sees user DBs directly —
//! everything flows through the CMS. Tokens live in Windows Credential
//! Manager via the `keyring` crate; never in JSON on disk.

use std::sync::{Mutex, OnceLock};

use keyring::Entry;
use serde::{Deserialize, Serialize};

const KEYRING_SERVICE: &str = "com.starfall.launcher";
const TOKEN_KEY: &str = "access-token";
const REFRESH_KEY: &str = "refresh-token";

/// Process-lifetime tokens when the user doesn't tick "stay signed in".
/// Holds (access_token, refresh_token). Cleared on logout or process exit.
fn ephemeral() -> &'static Mutex<Option<(String, String)>> {
    static E: OnceLock<Mutex<Option<(String, String)>>> = OnceLock::new();
    E.get_or_init(|| Mutex::new(None))
}

#[derive(thiserror::Error, Debug)]
pub enum AuthError {
    #[error("couldn't reach CMS: {0}")]
    Network(String),
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("2FA code required or invalid")]
    TwoFactor,
    #[error("CMS returned {0}: {1}")]
    Http(u16, String),
    #[error("couldn't parse CMS response: {0}")]
    Parse(String),
    #[error("credential store error: {0}")]
    Keyring(String),
}

impl Serialize for AuthError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        ser.serialize_str(&self.to_string())
    }
}

impl From<keyring::Error> for AuthError {
    fn from(e: keyring::Error) -> Self {
        AuthError::Keyring(e.to_string())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginOk {
    token: String,
    refresh_token: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum LoginResult {
    Ok { username: String },
    Needs2fa { pending_token: String },
}

fn client() -> Result<reqwest::Client, AuthError> {
    reqwest::Client::builder()
        .user_agent(concat!("starfall-launcher/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| AuthError::Network(e.to_string()))
}

fn store_tokens(token: &str, refresh: &str, remember: bool) -> Result<(), AuthError> {
    if remember {
        clear_ephemeral();
        Entry::new(KEYRING_SERVICE, TOKEN_KEY)?.set_password(token)?;
        Entry::new(KEYRING_SERVICE, REFRESH_KEY)?.set_password(refresh)?;
    } else {
        clear_keyring_tokens();
        if let Ok(mut e) = ephemeral().lock() {
            *e = Some((token.to_string(), refresh.to_string()));
        }
    }
    Ok(())
}

fn clear_keyring_tokens() {
    let _ = Entry::new(KEYRING_SERVICE, TOKEN_KEY).and_then(|e| e.delete_credential());
    let _ = Entry::new(KEYRING_SERVICE, REFRESH_KEY).and_then(|e| e.delete_credential());
}

fn clear_ephemeral() {
    if let Ok(mut e) = ephemeral().lock() {
        *e = None;
    }
}

fn clear_tokens() -> Result<(), AuthError> {
    clear_keyring_tokens();
    clear_ephemeral();
    Ok(())
}

fn read_access_token() -> Option<String> {
    if let Ok(e) = ephemeral().lock() {
        if let Some((t, _)) = e.as_ref() {
            return Some(t.clone());
        }
    }
    Entry::new(KEYRING_SERVICE, TOKEN_KEY)
        .ok()?
        .get_password()
        .ok()
}

#[derive(Deserialize)]
struct RawLogin {
    token: Option<String>,
    #[serde(rename = "refreshToken")]
    refresh_token: Option<String>,
    requires2fa: Option<bool>,
    #[serde(rename = "pendingToken")]
    pending_token: Option<String>,
}

async fn post_json<B: Serialize>(
    cms_base: &str,
    path: &str,
    body: &B,
    bearer: Option<&str>,
) -> Result<reqwest::Response, AuthError> {
    let url = format!("{}{}", cms_base.trim_end_matches('/'), path);
    let mut req = client()?.post(&url).json(body);
    if let Some(t) = bearer {
        req = req.bearer_auth(t);
    }
    req.send()
        .await
        .map_err(|e| AuthError::Network(e.to_string()))
}

async fn get_json(
    cms_base: &str,
    path: &str,
    bearer: Option<&str>,
) -> Result<reqwest::Response, AuthError> {
    let url = format!("{}{}", cms_base.trim_end_matches('/'), path);
    let mut req = client()?.get(&url);
    if let Some(t) = bearer {
        req = req.bearer_auth(t);
    }
    req.send()
        .await
        .map_err(|e| AuthError::Network(e.to_string()))
}

#[tauri::command]
pub async fn auth_login(
    cms_base: String,
    username: String,
    password: String,
    remember: bool,
) -> Result<LoginResult, AuthError> {
    #[derive(Serialize)]
    struct Body<'a> {
        username: &'a str,
        password: &'a str,
    }
    let resp = post_json(
        &cms_base,
        "/api/launcher/login",
        &Body {
            username: &username,
            password: &password,
        },
        None,
    )
    .await?;
    let status = resp.status();
    if status.as_u16() == 401 {
        return Err(AuthError::InvalidCredentials);
    }
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AuthError::Http(status.as_u16(), body));
    }
    let raw: RawLogin = resp
        .json()
        .await
        .map_err(|e| AuthError::Parse(e.to_string()))?;
    if raw.requires2fa.unwrap_or(false) {
        let pending = raw.pending_token.ok_or_else(|| {
            AuthError::Parse("login response missing pendingToken for 2FA".into())
        })?;
        return Ok(LoginResult::Needs2fa {
            pending_token: pending,
        });
    }
    let ok = into_login_ok(raw)?;
    store_tokens(&ok.token, &ok.refresh_token, remember)?;
    Ok(LoginResult::Ok { username })
}

#[tauri::command]
pub async fn auth_login_2fa(
    cms_base: String,
    pending_token: String,
    code: String,
    username: String,
    remember: bool,
) -> Result<LoginResult, AuthError> {
    #[derive(Serialize)]
    struct Body<'a> {
        #[serde(rename = "pendingToken")]
        pending_token: &'a str,
        code: &'a str,
    }
    let resp = post_json(
        &cms_base,
        "/api/launcher/login/2fa",
        &Body {
            pending_token: &pending_token,
            code: &code,
        },
        None,
    )
    .await?;
    if resp.status().as_u16() == 401 {
        return Err(AuthError::TwoFactor);
    }
    if !resp.status().is_success() {
        return Err(AuthError::Http(
            resp.status().as_u16(),
            resp.text().await.unwrap_or_default(),
        ));
    }
    let raw: RawLogin = resp
        .json()
        .await
        .map_err(|e| AuthError::Parse(e.to_string()))?;
    let ok = into_login_ok(raw)?;
    store_tokens(&ok.token, &ok.refresh_token, remember)?;
    Ok(LoginResult::Ok { username })
}

fn into_login_ok(raw: RawLogin) -> Result<LoginOk, AuthError> {
    Ok(LoginOk {
        token: raw
            .token
            .ok_or_else(|| AuthError::Parse("missing token".into()))?,
        refresh_token: raw
            .refresh_token
            .ok_or_else(|| AuthError::Parse("missing refreshToken".into()))?,
    })
}

#[tauri::command]
pub async fn auth_logout(cms_base: String) -> Result<(), AuthError> {
    if let Some(token) = read_access_token() {
        let _ = post_json(&cms_base, "/api/account/logout", &serde_json::json!({}), Some(&token)).await;
    }
    clear_tokens()?;
    Ok(())
}

#[tauri::command]
pub async fn auth_me(cms_base: String) -> Result<serde_json::Value, AuthError> {
    let token = read_access_token().ok_or(AuthError::InvalidCredentials)?;
    let resp = get_json(&cms_base, "/api/account/me", Some(&token)).await?;
    if resp.status().as_u16() == 401 {
        clear_tokens()?;
        return Err(AuthError::InvalidCredentials);
    }
    if !resp.status().is_success() {
        return Err(AuthError::Http(
            resp.status().as_u16(),
            resp.text().await.unwrap_or_default(),
        ));
    }
    resp.json()
        .await
        .map_err(|e| AuthError::Parse(e.to_string()))
}

/// Make an authenticated request on behalf of the frontend.
/// Frontend code never handles the token itself.
#[tauri::command]
pub async fn cms_fetch(
    cms_base: String,
    method: String,
    path: String,
    body: Option<serde_json::Value>,
) -> Result<serde_json::Value, AuthError> {
    let token = read_access_token();
    let url = format!("{}{}", cms_base.trim_end_matches('/'), path);
    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| AuthError::Parse(e.to_string()))?;
    let mut req = client()?.request(method, &url);
    if let Some(t) = &token {
        req = req.bearer_auth(t);
    }
    if let Some(b) = body {
        req = req.json(&b);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| AuthError::Network(e.to_string()))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| AuthError::Parse(e.to_string()))?;
    if !status.is_success() {
        return Err(AuthError::Http(status.as_u16(), text));
    }
    if text.is_empty() {
        return Ok(serde_json::Value::Null);
    }
    serde_json::from_str(&text).map_err(|e| AuthError::Parse(e.to_string()))
}

#[tauri::command]
pub async fn auth_has_token() -> Result<bool, AuthError> {
    Ok(read_access_token().is_some())
}
