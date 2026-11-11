use crate::error::AppError;
use crate::util;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

const KEYRING_SERVICE: &str = "giteasy.github";
const API_ROOT: &str = "https://api.github.com";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubAccount {
    pub login: String,
    pub name: String,
    pub avatar_url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubDeviceStart {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct AccessTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
}

#[derive(Deserialize)]
struct GitHubUser {
    login: String,
    name: Option<String>,
    avatar_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepo {
    pub id: u64,
    pub full_name: String,
    pub name: String,
    pub private: bool,
    pub clone_url: String,
    pub ssh_url: String,
    pub default_branch: String,
    pub description: Option<String>,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubNotification {
    pub id: String,
    pub unread: bool,
    pub reason: String,
    pub updated_at: String,
    pub subject: GitHubNotificationSubject,
    pub repository: GitHubNotificationRepo,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubNotificationSubject {
    pub title: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubNotificationRepo {
    pub full_name: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubIssue {
    pub id: u64,
    pub number: u64,
    pub title: String,
    pub state: String,
    pub html_url: String,
    pub created_at: String,
    pub updated_at: String,
    pub user: GitHubActor,
    pub pull_request: Option<Value>,
    pub assignee: Option<GitHubActor>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubActor {
    pub login: String,
    pub avatar_url: String,
}

#[derive(Clone)]
struct CachedResponse {
    etag: String,
    body: Value,
}

pub struct GitHubService {
    client: Client,
    accounts: Mutex<Vec<GitHubAccount>>,
    tokens: Mutex<HashMap<String, String>>,
    cache: Mutex<HashMap<String, CachedResponse>>,
}

impl GitHubService {
    pub fn new() -> Self {
        let accounts = load_accounts();
        Self {
            client: Client::builder()
                .user_agent("GitEasy/0.1")
                .build()
                .expect("build GitHub client"),
            accounts: Mutex::new(accounts),
            tokens: Mutex::new(HashMap::new()),
            cache: Mutex::new(HashMap::new()),
        }
    }

    pub fn accounts(&self) -> Vec<GitHubAccount> {
        self.accounts
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    async fn login_with_token(&self, token: String) -> Result<GitHubAccount, AppError> {
        let user: GitHubUser = self
            .client
            .get(format!("{API_ROOT}/user"))
            .bearer_auth(&token)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(network_error)?
            .error_for_status()
            .map_err(|error| github_http_error(error))?
            .json()
            .await
            .map_err(network_error)?;
        let account = GitHubAccount {
            login: user.login.clone(),
            name: user.name.unwrap_or_default(),
            avatar_url: user.avatar_url,
        };
        let entry = keyring_entry(&account.login)?;
        entry
            .set_password(&token)
            .map_err(|error| credential_error(error.to_string()))?;
        self.tokens
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(account.login.clone(), token);
        let mut accounts = self
            .accounts
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        accounts.retain(|item| item.login != account.login);
        accounts.insert(0, account.clone());
        save_accounts(&accounts)?;
        Ok(account)
    }

    fn logout(&self, login: &str) -> Result<(), AppError> {
        if let Ok(entry) = keyring_entry(login) {
            let _ = entry.delete_credential();
        }
        self.tokens
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(login);
        let mut accounts = self
            .accounts
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        accounts.retain(|account| account.login != login);
        save_accounts(&accounts)
    }

    fn token_for(&self, login: &str) -> Result<String, AppError> {
        if let Some(token) = self
            .tokens
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(login)
            .cloned()
        {
            return Ok(token);
        }
        let token = keyring_entry(login)?
            .get_password()
            .map_err(|error| {
                AppError::new("auth", "E_GITHUB_AUTH", "GitHub 登录已失效")
                    .with_hint("请重新登录 GitHub 账户")
                    .with_detail(error.to_string())
            })?;
        self.tokens
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(login.to_string(), token.clone());
        Ok(token)
    }

    async fn cached_get<T: for<'de> Deserialize<'de>>(
        &self,
        login: &str,
        cache_key: &str,
        url: &str,
    ) -> Result<T, AppError> {
        let token = self.token_for(login)?;
        let key = format!("{login}:{cache_key}");
        let cached = self
            .cache
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(&key)
            .cloned();
        let mut request = self
            .client
            .get(url)
            .bearer_auth(token)
            .header("Accept", "application/vnd.github+json");
        if let Some(cached) = &cached {
            request = request.header("If-None-Match", cached.etag.clone());
        }
        let response = match request.send().await {
            Ok(response) => response,
            Err(error) => {
                if let Some(cached) = cached {
                    return serde_json::from_value(cached.body).map_err(|error| {
                        AppError::new("github", "E_GITHUB_CACHE", "GitHub 缓存解析失败")
                            .with_detail(error.to_string())
                    });
                }
                return Err(network_error(error));
            }
        };
        if response.status() == StatusCode::NOT_MODIFIED {
            if let Some(cached) = cached {
                return serde_json::from_value(cached.body).map_err(|error| {
                    AppError::new("github", "E_GITHUB_CACHE", "GitHub 缓存解析失败")
                        .with_detail(error.to_string())
                });
            }
        }
        let response = response
            .error_for_status()
            .map_err(github_http_error)?;
        let etag = response
            .headers()
            .get("etag")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_string();
        let body: Value = response.json().await.map_err(network_error)?;
        if !etag.is_empty() {
            self.cache
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .insert(
                    key,
                    CachedResponse {
                        etag,
                        body: body.clone(),
                    },
                );
        }
        serde_json::from_value(body).map_err(|error| {
            AppError::new("github", "E_GITHUB_DECODE", "GitHub 返回数据解析失败")
                .with_detail(error.to_string())
        })
    }

    async fn create_pull_request(
        &self,
        login: &str,
        slug: &str,
        base: &str,
        head: &str,
        title: &str,
        body: &str,
        draft: bool,
    ) -> Result<Value, AppError> {
        let token = self.token_for(login)?;
        let response = self
            .client
            .post(format!("{API_ROOT}/repos/{slug}/pulls"))
            .bearer_auth(token)
            .header("Accept", "application/vnd.github+json")
            .json(&serde_json::json!({
                "title": title,
                "head": head,
                "base": base,
                "body": body,
                "draft": draft
            }))
            .send()
            .await
            .map_err(network_error)?
            .error_for_status()
            .map_err(github_http_error)?;
        response.json().await.map_err(network_error)
    }
}

#[tauri::command]
pub fn github_accounts(state: tauri::State<'_, crate::AppState>) -> Vec<GitHubAccount> {
    state.github.accounts()
}

#[tauri::command]
pub async fn github_login_token(
    state: tauri::State<'_, crate::AppState>,
    token: String,
) -> Result<GitHubAccount, AppError> {
    if token.trim().is_empty() {
        return Err(AppError::user("GitHub Token 不能为空"));
    }
    state.github.login_with_token(token.trim().to_string()).await
}

#[tauri::command]
pub fn github_logout(
    state: tauri::State<'_, crate::AppState>,
    login: String,
) -> Result<(), AppError> {
    state.github.logout(&login)
}

#[tauri::command]
pub async fn github_device_start(
    state: tauri::State<'_, crate::AppState>,
    client_id: String,
) -> Result<GitHubDeviceStart, AppError> {
    if client_id.trim().is_empty() {
        return Err(AppError::user("请先配置 GitHub OAuth App Client ID"));
    }
    let response: DeviceCodeResponse = state
        .github
        .client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.trim()),
            ("scope", "repo read:user notifications"),
        ])
        .send()
        .await
        .map_err(network_error)?
        .error_for_status()
        .map_err(github_http_error)?
        .json()
        .await
        .map_err(network_error)?;
    Ok(GitHubDeviceStart {
        device_code: response.device_code,
        user_code: response.user_code,
        verification_uri: response.verification_uri,
        expires_in: response.expires_in,
        interval: response.interval,
    })
}

#[tauri::command]
pub async fn github_device_poll(
    state: tauri::State<'_, crate::AppState>,
    client_id: String,
    device_code: String,
) -> Result<Option<GitHubAccount>, AppError> {
    let response: AccessTokenResponse = state
        .github
        .client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id.as_str()),
            ("device_code", device_code.as_str()),
            (
                "grant_type",
                "urn:ietf:params:oauth:grant-type:device_code",
            ),
        ])
        .send()
        .await
        .map_err(network_error)?
        .error_for_status()
        .map_err(github_http_error)?
        .json()
        .await
        .map_err(network_error)?;
    if let Some(token) = response.access_token {
        return state.github.login_with_token(token).await.map(Some);
    }
    match response.error.as_deref() {
        Some("authorization_pending") | Some("slow_down") => Ok(None),
        Some("expired_token") => Err(AppError::new(
            "auth",
            "E_GITHUB_DEVICE_EXPIRED",
            "GitHub 授权码已过期，请重新获取",
        )),
        Some("access_denied") => Err(AppError::new(
            "auth",
            "E_GITHUB_DEVICE_DENIED",
            "GitHub 授权已取消",
        )),
        Some(error) => Err(AppError::new(
            "github",
            "E_GITHUB_DEVICE",
            format!("GitHub 授权失败：{error}"),
        )),
        None => Err(AppError::new(
            "github",
            "E_GITHUB_DEVICE",
            "GitHub 未返回访问令牌",
        )),
    }
}

#[tauri::command]
pub async fn github_repos(
    state: tauri::State<'_, crate::AppState>,
    login: String,
    page: Option<usize>,
) -> Result<Vec<GitHubRepo>, AppError> {
    let page = page.unwrap_or(1).max(1);
    state
        .github
        .cached_get(
            &login,
            &format!("repos:{page}"),
            &format!("{API_ROOT}/user/repos?sort=updated&per_page=50&page={page}"),
        )
        .await
}

#[tauri::command]
pub async fn github_notifications(
    state: tauri::State<'_, crate::AppState>,
    login: String,
) -> Result<Vec<GitHubNotification>, AppError> {
    state
        .github
        .cached_get(
            &login,
            "notifications",
            &format!("{API_ROOT}/notifications?all=false&per_page=50"),
        )
        .await
}

#[tauri::command]
pub async fn github_pull_requests(
    state: tauri::State<'_, crate::AppState>,
    path: String,
    login: String,
    state_filter: Option<String>,
) -> Result<Vec<GitHubIssue>, AppError> {
    let slug = github_slug(&path)?;
    let state_filter = state_filter.unwrap_or_else(|| "open".to_string());
    state
        .github
        .cached_get(
            &login,
            &format!("pulls:{slug}:{state_filter}"),
            &format!(
                "{API_ROOT}/repos/{slug}/pulls?state={state_filter}&per_page=50"
            ),
        )
        .await
}

#[tauri::command]
pub async fn github_issues(
    state: tauri::State<'_, crate::AppState>,
    path: String,
    login: String,
    state_filter: Option<String>,
) -> Result<Vec<GitHubIssue>, AppError> {
    let slug = github_slug(&path)?;
    let state_filter = state_filter.unwrap_or_else(|| "open".to_string());
    state
        .github
        .cached_get(
            &login,
            &format!("issues:{slug}:{state_filter}"),
            &format!(
                "{API_ROOT}/repos/{slug}/issues?state={state_filter}&per_page=50"
            ),
        )
        .await
}

#[tauri::command]
pub async fn github_create_pull(
    state: tauri::State<'_, crate::AppState>,
    path: String,
    login: String,
    base: String,
    head: String,
    title: String,
    body: String,
    draft: bool,
) -> Result<Value, AppError> {
    if title.trim().is_empty() || head.trim().is_empty() || base.trim().is_empty() {
        return Err(AppError::user("PR 标题、源分支和目标分支不能为空"));
    }
    let slug = github_slug(&path)?;
    state
        .github
        .create_pull_request(
            &login,
            &slug,
            base.trim(),
            head.trim(),
            title.trim(),
            &body,
            draft,
        )
        .await
}

#[tauri::command]
pub async fn github_clone(url: String, target: String) -> Result<(), AppError> {
    if std::path::Path::new(&target).exists() {
        return Err(AppError::user("目标目录已存在"));
    }
    let parent = std::path::Path::new(&target)
        .parent()
        .ok_or_else(|| AppError::user("无效的克隆目录"))?;
    std::fs::create_dir_all(parent)?;
    util::git(
        &parent.to_string_lossy(),
        &["clone", url.as_str(), target.as_str()],
    )
    .await?;
    Ok(())
}

pub fn parse_github_slug(url: &str) -> Option<String> {
    let stripped = url
        .strip_prefix("git@github.com:")
        .or_else(|| url.strip_prefix("https://github.com/"))
        .or_else(|| url.strip_prefix("ssh://git@github.com/"))
        .or_else(|| url.strip_prefix("git+ssh://git@github.com/"))?;
    let slug = stripped.trim_end_matches(".git").trim_end_matches('/');
    let parts: Vec<&str> = slug.split('/').collect();
    (parts.len() >= 2).then(|| format!("{}/{}", parts[0], parts[1]))
}

fn github_slug(repo_path: &str) -> Result<String, AppError> {
    let repo = util::open_repo(repo_path)?;
    let url = repo
        .find_remote("origin")
        .ok()
        .and_then(|remote| remote.url().map(|value| value.to_string()))
        .or_else(|| {
            let names = repo.remotes().ok()?;
            names
                .iter()
                .flatten()
                .find_map(|name| repo.find_remote(name).ok()?.url().map(str::to_string))
        })
        .ok_or_else(|| AppError::not_found("当前仓库没有可识别的 GitHub 远程"))?;
    parse_github_slug(&url)
        .ok_or_else(|| AppError::user(format!("远程不是 GitHub 地址：{url}")))
}

fn keyring_entry(login: &str) -> Result<keyring::Entry, AppError> {
    keyring::Entry::new(KEYRING_SERVICE, login).map_err(|error| {
        AppError::new("keyring", "E_KEYRING", "无法访问系统凭据库")
            .with_detail(error.to_string())
    })
}

fn accounts_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("giteasy")
        .join("github_accounts.json")
}

fn load_accounts() -> Vec<GitHubAccount> {
    std::fs::read_to_string(accounts_path())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

fn save_accounts(accounts: &[GitHubAccount]) -> Result<(), AppError> {
    let path = accounts_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let text = serde_json::to_string_pretty(accounts)
        .map_err(|error| AppError::user(error.to_string()))?;
    std::fs::write(path, text)?;
    Ok(())
}

fn network_error(error: reqwest::Error) -> AppError {
    AppError::new("github", "E_GITHUB_NETWORK", "无法连接 GitHub")
        .with_hint("请检查网络连接后重试")
        .with_detail(error.to_string())
}

fn github_http_error(error: reqwest::Error) -> AppError {
    let status = error.status().map(|value| value.as_u16()).unwrap_or(0);
    if status == 401 {
        return AppError::new("auth", "E_GITHUB_AUTH", "GitHub 认证失败")
            .with_hint("请重新登录 GitHub");
    }
    if status == 403 {
        return AppError::new("github", "E_GITHUB_RATE_LIMIT", "GitHub API 请求受限")
            .with_hint("请稍后重试，或检查 Token 权限与速率限制")
            .with_detail(error.to_string());
    }
    AppError::new("github", "E_GITHUB_API", format!("GitHub API 错误（{status}）"))
        .with_detail(error.to_string())
}

fn credential_error(detail: String) -> AppError {
    AppError::new("keyring", "E_KEYRING_WRITE", "无法保存 GitHub 凭据")
        .with_hint("请确认系统 Secret Service / Keyring 正在运行")
        .with_detail(detail)
}

#[cfg(test)]
mod tests {
    use super::parse_github_slug;

    #[test]
    fn parses_github_remote_urls() {
        assert_eq!(
            parse_github_slug("git@github.com:owner/repo.git").as_deref(),
            Some("owner/repo")
        );
        assert_eq!(
            parse_github_slug("https://github.com/owner/repo.git").as_deref(),
            Some("owner/repo")
        );
        assert_eq!(
            parse_github_slug("ssh://git@github.com/owner/repo.git").as_deref(),
            Some("owner/repo")
        );
        assert_eq!(parse_github_slug("git@gitlab.com:owner/repo.git"), None);
    }
}
