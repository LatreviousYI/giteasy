use crate::error::AppError;
use std::process::Stdio;
use tauri::State;
use tokio::process::Command;

fn expand(command: &str, repo: &str, file: Option<&str>) -> String {
    command
        .replace("{repo}", repo)
        .replace("{file}", file.unwrap_or(""))
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

pub fn open_path_default(target: &str) -> std::io::Result<std::process::Child> {
    #[cfg(target_os = "macos")]
    {
        return std::process::Command::new("open").arg(target).spawn();
    }
    #[cfg(not(target_os = "macos"))]
    {
        std::process::Command::new("xdg-open").arg(target).spawn()
    }
}

#[tauri::command]
pub async fn run_custom_command(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    command: String,
    kind: String,
    file: Option<String>,
) -> Result<String, AppError> {
    let expanded = expand(&command, &path, file.as_deref());
    if kind == "url" {
        open_path_default(&expanded).map_err(|error| {
                AppError::new("io", "E_OPEN_URL", "无法打开自定义 URL")
                    .with_detail(error.to_string())
            })?;
        return Ok(String::new());
    }
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let started_at = crate::activity::now_millis();
    let started = std::time::Instant::now();
    let output = Command::new("bash")
        .args(["-lc", expanded.as_str()])
        .current_dir(&path)
        .env("GITEASY_REPO", &path)
        .env("GITEASY_FILE", file.unwrap_or_default())
        .stdin(Stdio::null())
        .output()
        .await
        .map_err(|error| {
            AppError::new("io", "E_CUSTOM_COMMAND", format!("无法运行自定义命令：{name}"))
                .with_detail(error.to_string())
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !output.status.success() {
        let error = AppError::new(
            "custom",
            "E_CUSTOM_COMMAND",
            format!("自定义命令失败：{name}"),
        )
        .with_detail(if stderr.is_empty() { stdout } else { stderr });
        crate::activity::record_error(
            &path,
            &expanded,
            started_at,
            started.elapsed().as_millis() as u64,
            &error,
        );
        return Err(error);
    }
    crate::activity::record_success(
        &path,
        &expanded,
        started_at,
        started.elapsed().as_millis() as u64,
        &stdout,
        &stderr,
    );
    Ok([stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n"))
}

#[tauri::command]
pub async fn run_external_tool(
    state: State<'_, crate::AppState>,
    path: String,
    file: String,
    tool: String,
    kind: String,
) -> Result<(), AppError> {
    if tool.trim().is_empty() {
        return Err(AppError::user("外部工具命令为空"));
    }
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let target = std::path::Path::new(&path).join(&file);
    let command = format!(
        "{} {}",
        tool,
        shell_quote(&target.to_string_lossy())
    );
    let status = Command::new("bash")
        .args(["-lc", command.as_str()])
        .current_dir(&path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map_err(|error| {
            AppError::new("io", "E_EXTERNAL_TOOL", "无法启动外部工具")
                .with_detail(error.to_string())
        })?;
    if !status.success() {
        return Err(AppError::new(
            "io",
            "E_EXTERNAL_TOOL",
            format!("外部 {kind} 工具执行失败"),
        ));
    }
    Ok(())
}
