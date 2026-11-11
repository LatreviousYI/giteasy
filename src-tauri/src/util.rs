use crate::error::AppError;
use git2::{Repository, Status, StatusOptions};
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

pub fn open_repo(path: &str) -> Result<Repository, AppError> {
    Repository::open(path).map_err(|e| {
        AppError::not_found(format!("无法打开 Git 仓库：{path}"))
            .with_hint("请选择一个包含 .git 目录的文件夹")
            .with_detail(e.message().to_string())
    })
}

pub fn canonical(path: &str) -> Result<PathBuf, AppError> {
    std::fs::canonicalize(path).map_err(|e| {
        AppError::not_found(format!("路径不存在：{path}")).with_detail(e.to_string())
    })
}

pub fn state_string(state: git2::RepositoryState) -> String {
    use git2::RepositoryState::*;
    match state {
        Clean => "clean",
        Merge => "merge",
        Revert | RevertSequence => "revert",
        CherryPick | CherryPickSequence => "cherry-pick",
        Bisect => "bisect",
        Rebase | RebaseInteractive | RebaseMerge => "rebase",
        ApplyMailbox | ApplyMailboxOrRebase => "am",
    }
    .to_string()
}

pub fn index_state(status: Status) -> &'static str {
    if status.contains(Status::CONFLICTED) {
        "conflicted"
    } else if status.contains(Status::INDEX_NEW) {
        "added"
    } else if status.contains(Status::INDEX_MODIFIED) {
        "modified"
    } else if status.contains(Status::INDEX_DELETED) {
        "deleted"
    } else if status.contains(Status::INDEX_RENAMED) {
        "renamed"
    } else if status.contains(Status::INDEX_TYPECHANGE) {
        "typechange"
    } else {
        "unmodified"
    }
}

pub fn worktree_state(status: Status) -> &'static str {
    if status.contains(Status::CONFLICTED) {
        "conflicted"
    } else if status.contains(Status::WT_NEW) {
        "untracked"
    } else if status.contains(Status::WT_MODIFIED) {
        "modified"
    } else if status.contains(Status::WT_DELETED) {
        "deleted"
    } else if status.contains(Status::WT_RENAMED) {
        "renamed"
    } else if status.contains(Status::WT_TYPECHANGE) {
        "typechange"
    } else {
        "unmodified"
    }
}

pub fn status_options() -> StatusOptions {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);
    opts
}

pub fn head_tree(repo: &Repository) -> Option<git2::Tree<'_>> {
    repo.head().ok().and_then(|h| h.peel_to_tree().ok())
}

pub async fn git<S: AsRef<OsStr>>(cwd: &str, args: &[S]) -> Result<String, AppError> {
    let output = git_output(cwd, args, None).await?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub async fn git_trimmed<S: AsRef<OsStr>>(cwd: &str, args: &[S]) -> Result<String, AppError> {
    let out = git(cwd, args).await?;
    Ok(out.trim().to_string())
}

pub async fn git_output<S: AsRef<OsStr>>(
    cwd: &str,
    args: &[S],
    input: Option<&[u8]>,
) -> Result<std::process::Output, AppError> {
    let command = crate::activity::command_text("git", args);
    let started_at = crate::activity::now_millis();
    let timer = Instant::now();
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("LC_ALL", "C")
        .env("GIT_EDITOR", "true")
        .env("GIT_MERGE_AUTOEDIT", "no")
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(error) => {
            let error = AppError::new("git", "E_SPAWN", "无法启动系统 git")
                .with_hint("请确认已安装 git 并位于 PATH 中")
                .with_detail(error.to_string());
            crate::activity::record_error(
                cwd,
                &command,
                started_at,
                timer.elapsed().as_millis() as u64,
                &error,
            );
            return Err(error);
        }
    };

    if let Some(bytes) = input {
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(bytes).await?;
            stdin.shutdown().await?;
        }
    }

    let output = match child.wait_with_output().await {
        Ok(output) => output,
        Err(error) => {
            let error = AppError::from(error);
            crate::activity::record_error(
                cwd,
                &command,
                started_at,
                timer.elapsed().as_millis() as u64,
                &error,
            );
            return Err(error);
        }
    };
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let error = map_git_failure(stderr, stdout);
        crate::activity::record_error(
            cwd,
            &command,
            started_at,
            timer.elapsed().as_millis() as u64,
            &error,
        );
        return Err(error);
    }
    crate::activity::record_success(
        cwd,
        &command,
        started_at,
        timer.elapsed().as_millis() as u64,
        &String::from_utf8_lossy(&output.stdout),
        &String::from_utf8_lossy(&output.stderr),
    );
    Ok(output)
}

pub fn map_git_failure(stderr: String, stdout: String) -> AppError {
    let text = if stderr.trim().is_empty() { stdout } else { stderr };
    let lower = text.to_lowercase();
    if lower.contains("identification has changed") {
        return AppError::new("ssh", "E_SSH_KEY_CHANGED", "SSH 主机密钥已变更")
            .with_hint("可能存在中间人攻击。请先核对代码托管平台公布的主机指纹，再手动更新 known_hosts")
            .with_detail(text);
    }
    if lower.contains("host key verification failed") {
        return AppError::new("ssh", "E_SSH_HOSTKEY", "SSH 主机密钥未受信任")
            .with_hint("首次连接需要确认主机指纹，应用会弹出确认窗口")
            .with_detail(text);
    }
    if lower.contains("permission denied (publickey)") {
        return AppError::new("auth", "E_SSH_AUTH", "SSH 公钥认证失败")
            .with_hint("请在 设置 → SSH 公钥 复制公钥，并添加到 Gitee/GitHub 等平台的 SSH 公钥设置中")
            .with_detail(text);
    }
    if lower.contains("authentication failed")
        || lower.contains("could not read username")
        || lower.contains("terminal prompts disabled")
    {
        return AppError::new("auth", "E_AUTH", "Git 认证失败")
            .with_hint("请先在终端配置 credential helper 或 SSH key，然后重试")
            .with_detail(text);
    }
    if lower.contains("conflict") || lower.contains("needs merge") {
        return AppError::new("conflict", "E_CONFLICT", "操作产生冲突，需要手动解决")
            .with_hint("切换到「冲突」视图完成合并")
            .with_detail(text);
    }
    if lower.contains("not a git repository") {
        return AppError::not_found("当前目录不是 Git 仓库").with_detail(text);
    }
    let first = text
        .lines()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("git 命令执行失败")
        .to_string();
    AppError::git(first, text)
}

pub fn index_content(repo: &Repository, file: &str) -> Option<String> {
    let index = repo.index().ok()?;
    let entry = index.get_path(Path::new(file), 0)?;
    let blob = repo.find_blob(entry.id).ok()?;
    Some(String::from_utf8_lossy(blob.content()).to_string())
}

pub fn workdir_content(repo: &Repository, file: &str) -> Option<String> {
    let workdir = repo.workdir()?;
    let full = workdir.join(file);
    let bytes = std::fs::read(full).ok()?;
    Some(String::from_utf8_lossy(&bytes).to_string())
}

pub fn short(oid: &str) -> String {
    oid.chars().take(7).collect()
}
