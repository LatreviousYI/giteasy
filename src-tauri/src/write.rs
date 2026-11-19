use crate::error::AppError;
use crate::model::ProgressEvent;
use crate::util;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{ipc::Channel, State};
use tokio::io::{AsyncRead, AsyncReadExt};

fn parse_progress(line: &str) -> ProgressEvent {
    let lower = line.to_lowercase();
    let phase = if lower.contains("receiving objects") {
        "接收对象"
    } else if lower.contains("resolving deltas") {
        "解析差异"
    } else if lower.contains("writing objects") {
        "写入对象"
    } else if lower.contains("counting objects") {
        "统计对象"
    } else if lower.contains("compressing objects") {
        "压缩对象"
    } else if lower.contains("enumerating objects") {
        "枚举对象"
    } else if lower.contains("updating files") {
        "更新文件"
    } else {
        ""
    };
    let percent = line.find('%').and_then(|idx| {
        let before = &line[..idx];
        before
            .split_whitespace()
            .last()?
            .trim_end_matches('.')
            .parse::<f64>()
            .ok()
    });
    ProgressEvent {
        phase: if phase.is_empty() {
            "git".to_string()
        } else {
            phase.to_string()
        },
        percent,
        message: line.to_string(),
        done: false,
        error: None,
    }
}

async fn pump<R: AsyncRead + Unpin>(
    mut reader: R,
    on_event: Channel<ProgressEvent>,
    collected: Arc<Mutex<String>>,
) {
    let mut buf = [0u8; 4096];
    let mut pending = String::new();
    loop {
        let n = match reader.read(&mut buf).await {
            Ok(0) => break,
            Ok(n) => n,
            Err(_) => break,
        };
        pending.push_str(&String::from_utf8_lossy(&buf[..n]));
        loop {
            let pos = pending
                .char_indices()
                .find(|(_, c)| *c == '\n' || *c == '\r')
                .map(|(i, _)| i);
            let Some(pos) = pos else { break };
            let line: String = pending.drain(..=pos).collect();
            let text = line.trim().to_string();
            if text.is_empty() {
                continue;
            }
            let mut buffer = util::lock_or_recover(&collected);
            buffer.push_str(&text);
            buffer.push('\n');
            let _ = on_event.send(parse_progress(&text));
        }
    }
    let text = pending.trim().to_string();
    if !text.is_empty() {
        util::lock_or_recover(&collected).push_str(&text);
        let _ = on_event.send(parse_progress(&text));
    }
}

async fn run_stream(
    path: &str,
    args: &[&str],
    on_event: &Channel<ProgressEvent>,
) -> Result<(), AppError> {
    run_stream_env(path, args, &[], on_event).await
}

pub(crate) async fn run_stream_env(
    path: &str,
    args: &[&str],
    envs: &[(&str, String)],
    on_event: &Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let invocation = util::GitInvocation::new(args);
    let _ = on_event.send(ProgressEvent {
        phase: "start".to_string(),
        percent: None,
        message: format!("git {}", args.join(" ")),
        done: false,
        error: None,
    });

    let mut cmd = util::git_command(path, args, false, envs);
    let mut child = cmd
        .spawn()
        .map_err(|error| invocation.spawn_error(path, error))?;

    let out_buf = Arc::new(Mutex::new(String::new()));
    let err_buf = Arc::new(Mutex::new(String::new()));
    let mut handles = Vec::new();
    if let Some(stdout) = child.stdout.take() {
        handles.push(tokio::spawn(pump(
            stdout,
            on_event.clone(),
            out_buf.clone(),
        )));
    }
    if let Some(stderr) = child.stderr.take() {
        handles.push(tokio::spawn(pump(
            stderr,
            on_event.clone(),
            err_buf.clone(),
        )));
    }
    let status = child
        .wait()
        .await
        .map_err(|error| invocation.io_error(path, error))?;
    for handle in handles {
        let _ = handle.await;
    }

    let stdout_text = util::lock_or_recover(&out_buf).clone();
    let stderr_text = util::lock_or_recover(&err_buf).clone();
    if !status.success() {
        let err = invocation.failure(path, stderr_text, stdout_text);
        let _ = on_event.send(ProgressEvent {
            phase: "error".to_string(),
            percent: None,
            message: err.message.clone(),
            done: true,
            error: Some(err.message.clone()),
        });
        return Err(err);
    }
    invocation.success(path, &stdout_text, &stderr_text);
    let _ = on_event.send(ProgressEvent {
        phase: "done".to_string(),
        percent: Some(100.0),
        message: "完成".to_string(),
        done: true,
        error: None,
    });
    Ok(())
}

#[tauri::command]
pub async fn stage_paths(
    state: State<'_, crate::AppState>,
    path: String,
    files: Vec<String>,
    stage: bool,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    stage_paths_impl(path, files, stage).await
}

pub(crate) async fn stage_paths_impl(
    path: String,
    files: Vec<String>,
    stage: bool,
) -> Result<(), AppError> {
    let mut args: Vec<String> = if stage {
        vec!["add".into(), "-A".into()]
    } else {
        vec!["restore".into(), "--staged".into()]
    };
    if files.is_empty() {
        args.push(".".into());
    } else {
        args.push("--".into());
        args.extend(files);
    }
    util::git(&path, &args).await?;
    Ok(())
}

#[tauri::command]
pub async fn discard_paths(
    state: State<'_, crate::AppState>,
    path: String,
    files: Vec<String>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    for file in files {
        if file.trim().is_empty() {
            continue;
        }
        let tracked = util::git_output(
            &path,
            &["ls-files", "--error-unmatch", "--", file.as_str()],
            None,
        )
        .await
        .is_ok();
        let full = Path::new(&path).join(&file);
        if tracked {
            let restored = util::git_output(
                &path,
                &[
                    "restore",
                    "--source=HEAD",
                    "--staged",
                    "--worktree",
                    "--",
                    file.as_str(),
                ],
                None,
            )
            .await;
            if restored.is_err() {
                let _ =
                    util::git_output(&path, &["restore", "--staged", "--", file.as_str()], None)
                        .await;
                if full.is_file() {
                    let _ = std::fs::remove_file(full);
                }
            }
        } else if full.is_file() {
            std::fs::remove_file(full)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn commit_create(
    state: State<'_, crate::AppState>,
    path: String,
    message: String,
    amend: bool,
    signoff: bool,
    stage_all: bool,
    gpg_sign: bool,
) -> Result<crate::model::CommitResult, AppError> {
    let gpg_key = gpg_sign.then(|| util::lock_or_recover(&state.settings).gpg_key.clone());
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    commit_create_impl(path, message, amend, signoff, stage_all, gpg_key).await
}

pub(crate) async fn commit_create_impl(
    path: String,
    message: String,
    amend: bool,
    signoff: bool,
    stage_all: bool,
    gpg_key: Option<String>,
) -> Result<crate::model::CommitResult, AppError> {
    if message.trim().is_empty() {
        return Err(AppError::user("提交信息不能为空"));
    }
    if stage_all {
        util::git(&path, &["add", "-A"]).await?;
    }
    let mut args: Vec<String> = vec!["commit".into(), "-F".into(), "-".into()];
    if amend {
        args.push("--amend".into());
    }
    if signoff {
        args.push("--signoff".into());
    }
    if let Some(key) = gpg_key {
        args.push(if key.trim().is_empty() {
            "--gpg-sign".into()
        } else {
            format!("--gpg-sign={}", key.trim())
        });
    }
    let output = util::git_output(&path, &args, Some(message.as_bytes())).await?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = [stdout, stderr]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    let oid = util::git_trimmed(&path, &["rev-parse", "HEAD"]).await?;
    Ok(crate::model::CommitResult {
        oid,
        output: combined,
    })
}

#[tauri::command]
pub async fn branch_create(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    checkout: bool,
    start_point: Option<String>,
) -> Result<crate::model::RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    branch_create_impl(path, name, checkout, start_point).await
}

pub(crate) async fn branch_create_impl(
    path: String,
    name: String,
    checkout: bool,
    start_point: Option<String>,
) -> Result<crate::model::RepoInfo, AppError> {
    if name.trim().is_empty() {
        return Err(AppError::user("分支名不能为空"));
    }
    let mut args: Vec<String> = if checkout {
        vec!["switch".into(), "-c".into(), name.clone()]
    } else {
        vec!["branch".into(), name.clone()]
    };
    if let Some(start) = start_point.filter(|s| !s.trim().is_empty()) {
        args.push(start);
    }
    util::git(&path, &args).await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn branch_checkout(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
) -> Result<crate::model::RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    branch_checkout_impl(path, name).await
}

pub(crate) async fn branch_checkout_impl(
    path: String,
    name: String,
) -> Result<crate::model::RepoInfo, AppError> {
    let refname = format!("refs/heads/{name}");
    let exists = util::git_output(
        &path,
        &["show-ref", "--verify", "--quiet", refname.as_str()],
        None,
    )
    .await
    .is_ok();
    if exists {
        util::git(&path, &["switch", name.as_str()]).await?;
    } else if name.contains('/') {
        let remotes = util::git(&path, &["remote"]).await.unwrap_or_default();
        let local = local_branch_name(&remotes, &name);
        util::git(
            &path,
            &["switch", "-c", local.as_str(), "--track", name.as_str()],
        )
        .await?;
    } else {
        util::git(&path, &["switch", name.as_str()]).await?;
    }
    crate::read::repo_info_inner(&path)
}

pub(crate) fn local_branch_name(remotes: &str, remote_branch: &str) -> String {
    remote_branch
        .split_once('/')
        .filter(|(remote, _)| remotes.lines().any(|item| item == *remote))
        .map(|(_, branch)| branch)
        .unwrap_or(remote_branch)
        .to_string()
}

#[tauri::command]
pub async fn commit_checkout(
    state: State<'_, crate::AppState>,
    path: String,
    oid: String,
) -> Result<crate::model::RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["switch", "--detach", oid.as_str()]).await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn branch_delete(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    force: bool,
    remote: Option<String>,
    remote_branch: Option<String>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    branch_delete_impl(path, name, force, remote, remote_branch).await
}

pub(crate) async fn branch_delete_impl(
    path: String,
    name: String,
    force: bool,
    remote: Option<String>,
    remote_branch: Option<String>,
) -> Result<(), AppError> {
    let remote = remote.filter(|value| !value.trim().is_empty());
    let remote_branch = remote_branch.filter(|value| !value.trim().is_empty());
    if remote.is_some() != remote_branch.is_some() {
        return Err(AppError::user(
            "删除远程分支时必须同时指定远程名称和分支名称",
        ));
    }

    let flag = if force { "-D" } else { "-d" };
    util::git(&path, &["branch", flag, name.as_str()]).await?;
    if let (Some(remote), Some(remote_branch)) = (remote, remote_branch) {
        if let Err(mut error) = util::git(
            &path,
            &["push", remote.as_str(), "--delete", remote_branch.as_str()],
        )
        .await
        {
            error.message = format!(
                "本地分支 {name} 已删除，但远程分支 {remote}/{remote_branch} 删除失败：{}",
                error.message
            );
            error.hint = Some(format!(
                "远程分支 {remote}/{remote_branch} 未删除，请检查远程配置或网络后重试"
            ));
            return Err(error);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn branch_rename(
    state: State<'_, crate::AppState>,
    path: String,
    old_name: String,
    new_name: String,
) -> Result<crate::model::RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(
        &path,
        &["branch", "-m", old_name.as_str(), new_name.as_str()],
    )
    .await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn branch_set_upstream(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    upstream: Option<String>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    if let Some(up) = upstream.filter(|s| !s.trim().is_empty()) {
        let flag = format!("--set-upstream-to={up}");
        util::git(&path, &["branch", flag.as_str(), name.as_str()]).await?;
    } else {
        util::git(&path, &["branch", "--unset-upstream", name.as_str()]).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn merge_branch(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["merge", "--no-edit", name.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn tag_create(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    message: Option<String>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let annotated = message
        .as_deref()
        .map(|m| !m.trim().is_empty())
        .unwrap_or(false);
    if annotated {
        let msg = message.unwrap_or_default();
        util::git(&path, &["tag", "-a", name.as_str(), "-m", msg.as_str()]).await?;
    } else {
        util::git(&path, &["tag", name.as_str()]).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn tag_delete(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["tag", "-d", name.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn tag_push(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    remote: Option<String>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let remote = remote
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "origin".to_string());
    let refspec = format!("refs/tags/{name}");
    util::git(&path, &["push", remote.as_str(), refspec.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn remote_branch_delete(
    state: State<'_, crate::AppState>,
    path: String,
    remote: String,
    branch: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    remote_branch_delete_impl(&path, &remote, &branch).await
}

pub(crate) async fn remote_branch_delete_impl(
    path: &str,
    remote: &str,
    branch: &str,
) -> Result<(), AppError> {
    util::git(path, &["push", remote, "--delete", branch]).await?;
    Ok(())
}

#[tauri::command]
pub async fn reset(
    state: State<'_, crate::AppState>,
    path: String,
    oid: String,
    mode: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let mode = match mode.as_str() {
        "soft" | "mixed" | "hard" => mode,
        _ => return Err(AppError::user("不支持的 reset 模式")),
    };
    let flag = format!("--{mode}");
    util::git(&path, &["reset", flag.as_str(), oid.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn cherry_pick(
    state: State<'_, crate::AppState>,
    path: String,
    oid: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["cherry-pick", oid.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn revert(
    state: State<'_, crate::AppState>,
    path: String,
    oid: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["revert", "--no-edit", oid.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn stash_save(
    state: State<'_, crate::AppState>,
    path: String,
    message: Option<String>,
    include_untracked: bool,
    paths: Option<Vec<String>>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    stash_save_impl(
        &path,
        message.as_deref(),
        include_untracked,
        paths.as_deref().unwrap_or(&[]),
    )
    .await
}

pub(crate) fn stash_args(
    message: Option<&str>,
    include_untracked: bool,
    paths: &[String],
) -> Vec<String> {
    let mut args: Vec<String> = vec!["stash".into(), "push".into()];
    if include_untracked {
        args.push("-u".into());
    }
    if let Some(msg) = message.filter(|m| !m.trim().is_empty()) {
        args.push("-m".into());
        args.push(msg.to_string());
    }
    let paths: Vec<String> = paths
        .iter()
        .filter(|path| !path.trim().is_empty())
        .cloned()
        .collect();
    if !paths.is_empty() {
        args.push("--".into());
        args.extend(paths);
    }
    args
}

pub(crate) async fn stash_save_impl(
    path: &str,
    message: Option<&str>,
    include_untracked: bool,
    paths: &[String],
) -> Result<(), AppError> {
    let args = stash_args(message, include_untracked, paths);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    util::git(path, &refs).await?;
    Ok(())
}

#[tauri::command]
pub async fn stash_apply(
    state: State<'_, crate::AppState>,
    path: String,
    index: usize,
    pop: bool,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let reference = format!("stash@{{{index}}}");
    let action = if pop { "pop" } else { "apply" };
    util::git(&path, &["stash", action, reference.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn stash_drop(
    state: State<'_, crate::AppState>,
    path: String,
    index: usize,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let reference = format!("stash@{{{index}}}");
    util::git(&path, &["stash", "drop", reference.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn remote_add(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
    url: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    remote_add_impl(&path, &name, &url).await
}

pub(crate) async fn remote_add_impl(path: &str, name: &str, url: &str) -> Result<(), AppError> {
    let name = name.trim();
    let url = url.trim();
    if name.is_empty() {
        return Err(AppError::user("remote 名称不能为空"));
    }
    if url.is_empty() {
        return Err(AppError::user("remote URL 不能为空"));
    }
    util::git(path, &["remote", "add", name, url]).await?;
    Ok(())
}

#[tauri::command]
pub async fn remote_update(
    state: State<'_, crate::AppState>,
    path: String,
    old_name: String,
    new_name: String,
    url: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    remote_update_impl(&path, &old_name, &new_name, &url).await
}

pub(crate) async fn remote_update_impl(
    path: &str,
    old_name: &str,
    new_name: &str,
    url: &str,
) -> Result<(), AppError> {
    let old_name = old_name.trim();
    let new_name = new_name.trim();
    let url = url.trim();
    if old_name.is_empty() {
        return Err(AppError::user("原 remote 名称不能为空"));
    }
    if new_name.is_empty() {
        return Err(AppError::user("新的 remote 名称不能为空"));
    }
    if url.is_empty() {
        return Err(AppError::user("remote URL 不能为空"));
    }

    let name_changed = old_name != new_name;
    if name_changed {
        util::git(path, &["remote", "rename", old_name, new_name]).await?;
    }

    let current = util::git_trimmed(path, &["remote", "get-url", new_name]).await?;
    if current != url {
        if let Err(mut error) = util::git(path, &["remote", "set-url", new_name, url]).await {
            if name_changed {
                error.message = format!(
                    "remote {old_name} 已改名为 {new_name}，但 URL 修改失败：{}",
                    error.message
                );
                error.hint = Some("remote 名称已修改，但 URL 未修改".to_string());
            }
            return Err(error);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn remote_remove(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    remote_remove_impl(&path, &name).await
}

pub(crate) async fn remote_remove_impl(path: &str, name: &str) -> Result<(), AppError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(AppError::user("remote 名称不能为空"));
    }
    util::git(path, &["remote", "remove", name]).await?;
    Ok(())
}

async fn run_stream_owned(
    path: &str,
    args: Vec<String>,
    on_event: &Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_stream(path, &refs, on_event).await
}

#[tauri::command]
pub async fn fetch(
    state: State<'_, crate::AppState>,
    path: String,
    remote: Option<String>,
    on_event: Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let mut args = vec![
        "fetch".to_string(),
        "--prune".to_string(),
        "--progress".to_string(),
    ];
    match remote.filter(|r| !r.trim().is_empty()) {
        Some(remote) => args.push(remote),
        None => args.push("--all".to_string()),
    }
    run_stream_owned(&path, args, &on_event).await
}

#[tauri::command]
pub async fn pull(
    state: State<'_, crate::AppState>,
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    mode: Option<String>,
    on_event: Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let args = pull_args(
        remote.as_deref(),
        branch.as_deref(),
        mode.as_deref().unwrap_or("auto"),
    )?;
    run_stream_owned(&path, args, &on_event).await
}

pub(crate) fn pull_args(
    remote: Option<&str>,
    branch: Option<&str>,
    mode: &str,
) -> Result<Vec<String>, AppError> {
    let mut args = vec!["pull".to_string(), "--progress".to_string()];
    match mode {
        "auto" => args.push("--ff".to_string()),
        "merge" => args.extend(["--no-rebase".to_string(), "--ff".to_string()]),
        "rebase" => args.push("--rebase".to_string()),
        "ff-only" => args.push("--ff-only".to_string()),
        _ => return Err(AppError::user("不支持的 Pull 策略")),
    }
    if let Some(remote) = remote.filter(|value| !value.trim().is_empty()) {
        args.push(remote.to_string());
        if let Some(branch) = branch.filter(|value| !value.trim().is_empty()) {
            args.push(branch.to_string());
        }
    }
    Ok(args)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn push(
    state: State<'_, crate::AppState>,
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    remote_branch: Option<String>,
    force: bool,
    set_upstream: bool,
    on_event: Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let args = push_args(
        remote.as_deref(),
        branch.as_deref(),
        remote_branch.as_deref(),
        force,
        set_upstream,
    );
    run_stream_owned(&path, args, &on_event).await
}

pub(crate) fn push_args(
    remote: Option<&str>,
    branch: Option<&str>,
    remote_branch: Option<&str>,
    force: bool,
    set_upstream: bool,
) -> Vec<String> {
    let mut args = vec!["push".to_string(), "--progress".to_string()];
    if force {
        args.push("--force-with-lease".to_string());
    }
    if set_upstream {
        args.push("-u".to_string());
    }
    if let Some(remote) = remote.filter(|value| !value.trim().is_empty()) {
        args.push(remote.to_string());
        if let Some(branch) = branch.filter(|value| !value.trim().is_empty()) {
            let target = match remote_branch.filter(|value| !value.trim().is_empty()) {
                Some(remote_branch) => format!("{branch}:{remote_branch}"),
                None => branch.to_string(),
            };
            args.push(target);
        }
    }
    args
}

#[tauri::command]
pub async fn op_abort(
    state: State<'_, crate::AppState>,
    path: String,
    op: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    match op.as_str() {
        "merge" | "rebase" | "cherry-pick" | "revert" => {}
        _ => return Err(AppError::user("不支持的操作")),
    }
    util::git(&path, &[op.as_str(), "--abort"]).await?;
    Ok(())
}

#[tauri::command]
pub async fn op_continue(
    state: State<'_, crate::AppState>,
    path: String,
    op: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    match op.as_str() {
        "merge" => {
            util::git(&path, &["commit", "--no-edit"]).await?;
        }
        "rebase" | "cherry-pick" | "revert" => {
            util::git(&path, &[op.as_str(), "--continue"]).await?;
        }
        _ => return Err(AppError::user("不支持的操作")),
    }
    Ok(())
}

#[tauri::command]
pub async fn conflict_resolve(
    state: State<'_, crate::AppState>,
    path: String,
    file: String,
    content: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let full = Path::new(&path).join(&file);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&full, content)?;
    util::git(&path, &["add", "--", file.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn submodule_update(
    state: State<'_, crate::AppState>,
    path: String,
    init: bool,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    let mut args: Vec<String> = vec!["submodule".into(), "update".into(), "--recursive".into()];
    if init {
        args.push("--init".into());
    }
    util::git(&path, &args).await?;
    Ok(())
}

#[tauri::command]
pub async fn submodule_add(
    state: State<'_, crate::AppState>,
    path: String,
    url: String,
    target: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["submodule", "add", url.as_str(), target.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn submodule_remove(
    state: State<'_, crate::AppState>,
    path: String,
    target: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["submodule", "deinit", "-f", "--", target.as_str()]).await?;
    util::git(&path, &["rm", "-f", "--", target.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn submodule_move(
    state: State<'_, crate::AppState>,
    path: String,
    old_path: String,
    new_path: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["mv", old_path.as_str(), new_path.as_str()]).await?;
    util::git(&path, &["submodule", "sync", "--recursive"]).await?;
    Ok(())
}

#[tauri::command]
pub async fn worktree_add(
    state: State<'_, crate::AppState>,
    path: String,
    dir: String,
    branch: Option<String>,
    new_branch: bool,
    start_point: Option<String>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    worktree_add_impl(
        &path,
        &dir,
        branch.as_deref(),
        new_branch,
        start_point.as_deref(),
    )
    .await
}

pub(crate) fn worktree_add_args(
    dir: &str,
    branch: Option<&str>,
    new_branch: bool,
    start_point: Option<&str>,
) -> Vec<String> {
    let mut args: Vec<String> = vec!["worktree".into(), "add".into()];
    let branch = branch.filter(|b| !b.trim().is_empty());
    if new_branch {
        if let Some(branch) = branch {
            args.push("-b".into());
            args.push(branch.to_string());
        }
    }
    args.push(dir.to_string());
    if !new_branch {
        if let Some(branch) = branch {
            args.push(branch.to_string());
        }
    }
    if new_branch {
        if let Some(start_point) = start_point.filter(|value| !value.trim().is_empty()) {
            args.push(start_point.to_string());
        }
    }
    args
}

pub(crate) async fn worktree_add_impl(
    path: &str,
    dir: &str,
    branch: Option<&str>,
    new_branch: bool,
    start_point: Option<&str>,
) -> Result<(), AppError> {
    let args = worktree_add_args(dir, branch, new_branch, start_point);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    util::git(path, &refs).await?;
    Ok(())
}

#[tauri::command]
pub async fn worktree_remove(
    state: State<'_, crate::AppState>,
    path: String,
    dir: String,
    force: bool,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    worktree_remove_impl(&path, &dir, force).await
}

pub(crate) async fn worktree_remove_impl(
    path: &str,
    dir: &str,
    force: bool,
) -> Result<(), AppError> {
    let mut args: Vec<String> = vec!["worktree".into(), "remove".into(), dir.to_string()];
    if force {
        args.push("--force".into());
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    util::git(path, &refs).await?;
    Ok(())
}

#[tauri::command]
pub async fn lfs_unlock(
    state: State<'_, crate::AppState>,
    path: String,
    id: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["lfs", "unlock", "--id", id.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn bisect_start(
    state: State<'_, crate::AppState>,
    path: String,
    bad: String,
    good: String,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["bisect", "start", bad.as_str(), good.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn bisect_mark(
    state: State<'_, crate::AppState>,
    path: String,
    mark: String,
) -> Result<(), AppError> {
    if mark != "good" && mark != "bad" {
        return Err(AppError::user("Bisect 标记必须是 good 或 bad"));
    }
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["bisect", mark.as_str()]).await?;
    Ok(())
}

#[tauri::command]
pub async fn bisect_skip(state: State<'_, crate::AppState>, path: String) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["bisect", "skip"]).await?;
    Ok(())
}

#[tauri::command]
pub async fn bisect_reset(state: State<'_, crate::AppState>, path: String) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    util::git(&path, &["bisect", "reset"]).await?;
    Ok(())
}

#[tauri::command]
pub fn open_in_editor(
    state: tauri::State<'_, crate::AppState>,
    path: String,
    file: Option<String>,
) -> Result<(), AppError> {
    let editor = util::lock_or_recover(&state.settings)
        .external_editor
        .clone();
    let target = file
        .map(|f| Path::new(&path).join(f).to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    let parts: Vec<&str> = editor.split_whitespace().collect();
    let spawned = if parts.is_empty() {
        crate::tools::open_path_default(&target)
    } else {
        std::process::Command::new(parts[0])
            .args(&parts[1..])
            .arg(&target)
            .spawn()
    };
    spawned.map(|_| ()).map_err(|e| {
        AppError::new("io", "E_OPEN", "无法打开编辑器")
            .with_hint("请在设置中配置外部编辑器命令")
            .with_detail(e.to_string())
    })
}

#[tauri::command]
pub fn open_in_terminal(
    state: tauri::State<'_, crate::AppState>,
    path: String,
) -> Result<(), AppError> {
    let configured = util::lock_or_recover(&state.settings).terminal.clone();
    let terminal = if !configured.trim().is_empty() {
        configured
    } else {
        std::env::var("TERMINAL").unwrap_or_else(|_| {
            if cfg!(target_os = "macos") {
                "Terminal".to_string()
            } else {
                "x-terminal-emulator".to_string()
            }
        })
    };
    let spawned = if cfg!(target_os = "macos") && terminal == "Terminal" {
        std::process::Command::new("open")
            .args(["-a", "Terminal"])
            .arg(&path)
            .spawn()
    } else {
        std::process::Command::new(&terminal)
            .current_dir(&path)
            .spawn()
    };
    spawned.map(|_| ()).map_err(|e| {
        AppError::new("io", "E_TERMINAL", "无法启动终端")
            .with_hint("请在设置中配置终端命令")
            .with_detail(e.to_string())
    })
}
