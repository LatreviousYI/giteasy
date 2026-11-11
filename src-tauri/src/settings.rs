use crate::error::AppError;
use crate::model::{Identity, RepoInfo};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const DEFAULT_THEME: &str = "system";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct RecentRepo {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomCommand {
    pub name: String,
    pub command: String,
    pub kind: String,
}

impl Default for RecentRepo {
    fn default() -> Self {
        Self {
            path: String::new(),
            name: String::new(),
            last_opened: 0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub theme: String,
    pub mono_font: String,
    pub font_size: u32,
    pub external_editor: String,
    pub terminal: String,
    pub auto_fetch_minutes: u32,
    pub gpg_sign: bool,
    pub gpg_key: String,
    pub external_diff_tools: Vec<String>,
    pub external_merge_tools: Vec<String>,
    pub custom_commands: Vec<CustomCommand>,
    pub recent: Vec<RecentRepo>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: DEFAULT_THEME.to_string(),
            mono_font: "JetBrains Mono".to_string(),
            font_size: 13,
            external_editor: String::new(),
            terminal: String::new(),
            auto_fetch_minutes: 0,
            gpg_sign: false,
            gpg_key: String::new(),
            external_diff_tools: Vec::new(),
            external_merge_tools: Vec::new(),
            custom_commands: Vec::new(),
            recent: Vec::new(),
        }
    }
}

fn settings_path() -> PathBuf {
    let base = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("giteasy");
    base.join("settings.json")
}

pub fn load() -> Settings {
    let path = settings_path();
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
        Err(_) => Settings::default(),
    }
}

pub fn save(settings: &Settings) -> Result<(), AppError> {
    let path = settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(settings)
        .map_err(|e| AppError::user(format!("设置序列化失败：{e}")))?;
    fs::write(path, text)?;
    Ok(())
}

pub fn remember(state: &crate::AppState, info: &RepoInfo) {
    let mut guard = state.settings.lock().unwrap();
    guard.recent.retain(|r| r.path != info.path);
    guard.recent.insert(
        0,
        RecentRepo {
            path: info.path.clone(),
            name: info.name.clone(),
            last_opened: now_seconds(),
        },
    );
    guard.recent.truncate(12);
    let snapshot = guard.clone();
    drop(guard);
    let _ = save(&snapshot);
}

pub fn now_seconds() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn settings_get(state: tauri::State<'_, crate::AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
pub fn settings_set(
    state: tauri::State<'_, crate::AppState>,
    settings: Settings,
) -> Result<Settings, AppError> {
    let mut guard = state.settings.lock().unwrap();
    let mut next = settings;
    next.recent = guard.recent.clone();
    save(&next)?;
    *guard = next.clone();
    Ok(next)
}

#[tauri::command]
pub fn repo_recent(state: tauri::State<'_, crate::AppState>) -> Vec<RecentRepo> {
    state.settings.lock().unwrap().recent.clone()
}

#[tauri::command]
pub fn repo_forget(state: tauri::State<'_, crate::AppState>, path: String) -> Result<(), AppError> {
    let mut guard = state.settings.lock().unwrap();
    guard.recent.retain(|r| r.path != path);
    let snapshot = guard.clone();
    drop(guard);
    save(&snapshot)
}

#[tauri::command]
pub fn repo_rename_recent(
    state: tauri::State<'_, crate::AppState>,
    path: String,
    name: String,
) -> Result<(), AppError> {
    let mut guard = state.settings.lock().unwrap();
    if let Some(repo) = guard.recent.iter_mut().find(|repo| repo.path == path) {
        repo.name = name;
    }
    let snapshot = guard.clone();
    drop(guard);
    save(&snapshot)
}

#[tauri::command]
pub async fn identity_get() -> Result<Identity, AppError> {
    let name = crate::util::git_trimmed(".", &["config", "--global", "user.name"])
        .await
        .unwrap_or_default();
    let email = crate::util::git_trimmed(".", &["config", "--global", "user.email"])
        .await
        .unwrap_or_default();
    Ok(Identity { name, email })
}

#[tauri::command]
pub async fn identity_set(name: String, email: String) -> Result<Identity, AppError> {
    if !name.trim().is_empty() {
        crate::util::git(".", &["config", "--global", "user.name", name.trim()]).await?;
    }
    if !email.trim().is_empty() {
        crate::util::git(".", &["config", "--global", "user.email", email.trim()]).await?;
    }
    identity_get().await
}
