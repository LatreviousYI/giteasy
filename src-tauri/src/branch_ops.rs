use crate::error::AppError;
use crate::model::RepoInfo;
use crate::util;
use std::collections::HashSet;
use tauri::State;

const MAX_COMMITS_PER_OPERATION: usize = 100;

fn normalize_oids(oids: Vec<String>) -> Result<Vec<String>, AppError> {
    if oids.is_empty() {
        return Err(AppError::user("请选择至少一个提交"));
    }

    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for oid in oids {
        let oid = oid.trim().to_string();
        if oid.len() != 40 || !oid.chars().all(|character| character.is_ascii_hexdigit()) {
            return Err(AppError::user("提交 OID 格式无效"));
        }
        if seen.insert(oid.clone()) {
            normalized.push(oid);
        }
    }

    if normalized.len() > MAX_COMMITS_PER_OPERATION {
        return Err(AppError::user(format!(
            "单次最多处理 {MAX_COMMITS_PER_OPERATION} 个提交"
        )));
    }
    Ok(normalized)
}

async fn ensure_non_merge_commit(path: &str, oid: &str) -> Result<(), AppError> {
    let output = util::git_trimmed(path, &["rev-list", "--parents", "-n", "1", oid]).await?;
    let parent_count = output.split_whitespace().skip(1).count();
    if parent_count > 1 {
        return Err(AppError::user("暂不支持对 Merge 提交执行此操作")
            .with_hint("该提交有多个父提交，需要先指定 mainline；请在命令行中完成此操作"));
    }
    Ok(())
}

async fn ensure_ancestor(path: &str, oid: &str) -> Result<(), AppError> {
    let path = path.to_string();
    let oid = oid.to_string();
    let is_ancestor = tauri::async_runtime::spawn_blocking(move || {
        crate::read::commit_is_ancestor_inner(&path, &oid)
    })
    .await
    .map_err(|error| {
        AppError::new("runtime", "E_BLOCKING_READ", "后台检查提交历史失败")
            .with_detail(error.to_string())
    })??;
    if !is_ancestor {
        return Err(AppError::user("所选提交不在当前分支历史中，无法回滚")
            .with_hint("可以改用 Cherry-pick 将该提交应用到当前分支"));
    }
    Ok(())
}

#[tauri::command]
pub async fn merge_branch(
    state: State<'_, crate::AppState>,
    path: String,
    name: String,
) -> Result<RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    merge_branch_impl(path, name).await
}

pub(crate) async fn merge_branch_impl(path: String, name: String) -> Result<RepoInfo, AppError> {
    util::git(&path, &["merge", "--no-edit", name.as_str()]).await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn rebase_branch(
    state: State<'_, crate::AppState>,
    path: String,
    onto: String,
) -> Result<RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    rebase_branch_impl(path, onto).await
}

pub(crate) async fn rebase_branch_impl(path: String, onto: String) -> Result<RepoInfo, AppError> {
    util::git(&path, &["rebase", onto.as_str()]).await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn squash_merge_branch(
    state: State<'_, crate::AppState>,
    path: String,
    source: String,
    message: String,
) -> Result<RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    squash_merge_branch_impl(path, source, message).await
}

pub(crate) async fn squash_merge_branch_impl(
    path: String,
    source: String,
    message: String,
) -> Result<RepoInfo, AppError> {
    let message = message.trim();
    if message.is_empty() {
        return Err(AppError::user("Squash 提交信息不能为空"));
    }

    util::git(&path, &["merge", "--squash", source.as_str()]).await?;
    util::git(&path, &["commit", "-m", message])
        .await
        .map_err(|mut error| {
            error.message = format!("Squash 差异已暂存，但创建提交失败：{}", error.message);
            error.hint = Some("修改提交信息或工作区后重试提交，已暂存的差异不会丢失".to_string());
            error
        })?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn reset(
    state: State<'_, crate::AppState>,
    path: String,
    oid: String,
    mode: String,
) -> Result<RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    reset_impl(path, oid, mode).await
}

pub(crate) async fn reset_impl(
    path: String,
    oid: String,
    mode: String,
) -> Result<RepoInfo, AppError> {
    let mode = match mode.as_str() {
        "soft" | "mixed" | "hard" => mode,
        _ => return Err(AppError::user("不支持的 reset 模式")),
    };
    let flag = format!("--{mode}");
    util::git(&path, &["reset", flag.as_str(), oid.as_str()]).await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn cherry_pick(
    state: State<'_, crate::AppState>,
    path: String,
    oids: Vec<String>,
) -> Result<RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    cherry_pick_impl(path, oids).await
}

pub(crate) async fn cherry_pick_impl(
    path: String,
    oids: Vec<String>,
) -> Result<RepoInfo, AppError> {
    let oids = normalize_oids(oids)?;
    for oid in &oids {
        ensure_non_merge_commit(&path, oid).await?;
    }
    let mut args = vec!["cherry-pick".to_string(), "--no-edit".to_string()];
    args.extend(oids);
    util::git(&path, &args).await?;
    crate::read::repo_info_inner(&path)
}

#[tauri::command]
pub async fn revert(
    state: State<'_, crate::AppState>,
    path: String,
    oids: Vec<String>,
) -> Result<RepoInfo, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    revert_impl(path, oids).await
}

pub(crate) async fn revert_impl(path: String, oids: Vec<String>) -> Result<RepoInfo, AppError> {
    let oids = normalize_oids(oids)?;
    for oid in &oids {
        ensure_non_merge_commit(&path, oid).await?;
        ensure_ancestor(&path, oid).await?;
    }
    let mut args = vec!["revert".to_string(), "--no-edit".to_string()];
    args.extend(oids);
    util::git(&path, &args).await?;
    crate::read::repo_info_inner(&path)
}
