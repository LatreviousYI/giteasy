use crate::error::AppError;
use crate::util;
use serde::Serialize;
use std::io::Write;
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshHostProbe {
    pub host: String,
    pub keys: Vec<String>,
    pub fingerprints: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SshPublicKey {
    pub path: String,
    pub content: String,
    pub exists: bool,
}

pub fn parse_ssh_host(url: &str) -> Option<String> {
    let stripped = url
        .strip_prefix("ssh://")
        .or_else(|| url.strip_prefix("git+ssh://"))
        .or_else(|| url.strip_prefix("ssh+git://"))
        .unwrap_or(url);
    if stripped.starts_with("http://")
        || stripped.starts_with("https://")
        || stripped.starts_with("file://")
    {
        return None;
    }
    let after_user = stripped
        .rsplit_once('@')
        .map(|(_, rest)| rest)
        .unwrap_or(stripped);
    if after_user == stripped && !stripped.contains(':') {
        return None;
    }
    let authority = after_user.split('/').next().unwrap_or(after_user);
    let host = if let Some(rest) = authority.strip_prefix('[') {
        rest.split(']').next()?.to_string()
    } else {
        authority.split(':').next()?.to_string()
    };
    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

fn remote_url(path: &str, remote: &str) -> Result<String, AppError> {
    let repo = util::open_repo(path)?;
    let item = repo.find_remote(remote).map_err(|error| {
        AppError::not_found(format!("找不到远程 {remote}")).with_detail(error.message().to_string())
    })?;
    item.url()
        .map(|value| value.to_string())
        .ok_or_else(|| AppError::user(format!("远程 {remote} 没有配置 URL")))
}

async fn remote_url_blocking(path: String, remote: String) -> Result<String, AppError> {
    tauri::async_runtime::spawn_blocking(move || remote_url(&path, &remote))
        .await
        .map_err(|error| {
            AppError::new("runtime", "E_BLOCKING_SSH", "后台读取 SSH 远程配置失败")
                .with_detail(error.to_string())
        })?
}

#[tauri::command]
pub async fn ssh_probe_remote(path: String, remote: String) -> Result<SshHostProbe, AppError> {
    let url = remote_url_blocking(path, remote.clone()).await?;
    let host = parse_ssh_host(&url).ok_or_else(|| {
        AppError::user("该远程不是 SSH 地址，无需确认主机指纹")
    })?;

    let output = Command::new("ssh-keyscan")
        .args(["-T", "8", "-t", "rsa,ecdsa,ed25519", host.as_str()])
        .output()
        .await
        .map_err(|error| {
            AppError::new("ssh", "E_SSH_SCAN", "无法执行 ssh-keyscan")
                .with_hint("请确认系统已安装 OpenSSH 客户端")
                .with_detail(error.to_string())
        })?;

    let keys: Vec<String> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .collect();

    if keys.is_empty() {
        return Err(AppError::new("ssh", "E_SSH_SCAN", format!("无法获取 {host} 的主机密钥"))
            .with_hint("请检查网络连接或主机名是否正确")
            .with_detail(String::from_utf8_lossy(&output.stderr).to_string()));
    }

    let fingerprints = fingerprint(&keys).await.unwrap_or_default();
    Ok(SshHostProbe {
        host,
        keys,
        fingerprints,
    })
}

async fn fingerprint(keys: &[String]) -> Result<Vec<String>, AppError> {
    let mut child = Command::new("ssh-keygen")
        .args(["-lf", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        let mut input = keys.join("\n");
        input.push('\n');
        stdin.write_all(input.as_bytes()).await?;
        stdin.shutdown().await?;
    }
    let output = child.wait_with_output().await?;
    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(|line| line.trim().to_string())
        .filter(|line| !line.is_empty())
        .collect())
}

#[tauri::command]
pub async fn ssh_trust_remote(
    path: String,
    remote: String,
    keys: Vec<String>,
) -> Result<(), AppError> {
    let url = remote_url_blocking(path, remote.clone()).await?;
    let host = parse_ssh_host(&url)
        .ok_or_else(|| AppError::user("该远程不是 SSH 地址，无需写入 known_hosts"))?;

    let home = dirs::home_dir().ok_or_else(|| AppError::user("无法定位用户主目录"))?;
    let ssh_dir = home.join(".ssh");
    std::fs::create_dir_all(&ssh_dir)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&ssh_dir, std::fs::Permissions::from_mode(0o700));
    }

    let known_hosts = ssh_dir.join("known_hosts");
    let existing = std::fs::read_to_string(&known_hosts).unwrap_or_default();
    let mut additions: Vec<String> = Vec::new();

    for key in keys {
        let line = key.trim().to_string();
        if line.is_empty() {
            continue;
        }
        let key_host = line.split_whitespace().next().unwrap_or("");
        let host_matches = key_host == host
            || key_host == format!("[{host}]")
            || key_host.starts_with(&format!("[{host}]:"))
            || key_host
                .strip_prefix(&format!("{host}:"))
                .is_some_and(|rest| rest.chars().all(|c| c.is_ascii_digit()));
        if !host_matches {
            continue;
        }
        if existing.lines().any(|item| item.trim() == line)
            || additions.iter().any(|item| item == &line)
        {
            continue;
        }
        additions.push(line);
    }

    if additions.is_empty() {
        return Ok(());
    }

    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&known_hosts)?;
    writeln!(file, "{}", additions.join("\n"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&known_hosts, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[tauri::command]
pub fn ssh_public_key() -> SshPublicKey {
    let home = dirs::home_dir().unwrap_or_default();
    for name in ["id_ed25519.pub", "id_ecdsa.pub", "id_rsa.pub"] {
        let path = home.join(".ssh").join(name);
        if let Ok(content) = std::fs::read_to_string(&path) {
            return SshPublicKey {
                path: path.to_string_lossy().to_string(),
                content: content.trim().to_string(),
                exists: true,
            };
        }
    }
    SshPublicKey {
        path: home
            .join(".ssh")
            .join("id_ed25519.pub")
            .to_string_lossy()
            .to_string(),
        content: String::new(),
        exists: false,
    }
}

#[cfg(test)]
mod tests {
    use super::parse_ssh_host;

    #[test]
    fn parses_common_ssh_urls() {
        assert_eq!(
            parse_ssh_host("git@gitee.com:kerwin_lv/test.git").as_deref(),
            Some("gitee.com")
        );
        assert_eq!(
            parse_ssh_host("ssh://git@codeup.aliyun.com:22/group/repo.git").as_deref(),
            Some("codeup.aliyun.com")
        );
        assert_eq!(parse_ssh_host("https://github.com/user/repo.git"), None);
        assert_eq!(parse_ssh_host("/tmp/remote.git"), None);
    }
}
