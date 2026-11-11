use crate::error::AppError;
use crate::model::*;
use crate::util;
use git2::{BlameOptions, Delta, Diff, DiffFindOptions, DiffOptions, Oid, Patch, Repository};
use std::collections::BTreeMap;
use std::path::Path;
use tauri::State;

const LOG_FORMAT: &str = "%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%s%x1f%D%x1f%b%x1e";

async fn blocking_read<T, F>(task: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, AppError> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| {
            AppError::new("runtime", "E_BLOCKING_READ", "后台读取任务失败")
                .with_detail(error.to_string())
        })?
}

pub fn repo_info_inner(path: &str) -> Result<RepoInfo, AppError> {
    let repo = util::open_repo(path)?;
    let head = repo.head().ok();
    let detached = head.as_ref().map(|h| !h.is_branch()).unwrap_or(false);
    let branch = if detached {
        None
    } else {
        head.as_ref()
            .and_then(|h| h.shorthand().map(|s| s.to_string()))
    };
    let head_oid = head.as_ref().and_then(|h| h.target()).map(|o| o.to_string());
    let name = std::path::Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());
    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|s| s.to_string()))
        .or_else(|| {
            let names = repo.remotes().ok()?;
            let first = names.get(0)?;
            let remote = repo.find_remote(first).ok()?;
            remote.url().map(|s| s.to_string())
        });
    Ok(RepoInfo {
        path: path.to_string(),
        name,
        branch,
        head_short: head_oid.as_ref().map(|o| util::short(o)),
        head_oid,
        detached,
        bare: repo.is_bare(),
        remote_url,
        state: util::state_string(repo.state()),
    })
}

#[tauri::command]
pub async fn repo_open(
    app: tauri::AppHandle,
    state: State<'_, crate::AppState>,
    path: String,
) -> Result<RepoInfo, AppError> {
    let canonical = util::canonical(&path)?;
    let canonical_str = canonical.to_string_lossy().to_string();
    let info = blocking_read(move || repo_info_inner(&canonical_str)).await?;
    crate::settings::remember(&state, &info);
    crate::watcher::watch(&app, &state, &info.path)?;
    state.sessions.ensure(&info.path);
    Ok(info)
}

#[tauri::command]
pub fn repo_close(state: State<'_, crate::AppState>, path: String) -> Result<(), AppError> {
    repo_close_inner(&state, &path);
    Ok(())
}

pub(crate) fn repo_close_inner(state: &crate::AppState, path: &str) {
    let repo_id = util::canonical(path)
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string());
    state
        .watchers
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(&repo_id);
    state.sessions.remove(&repo_id);
}

#[tauri::command]
pub async fn repo_init(
    app: tauri::AppHandle,
    state: State<'_, crate::AppState>,
    path: String,
) -> Result<RepoInfo, AppError> {
    std::fs::create_dir_all(&path)?;
    let init_path = path.clone();
    blocking_read(move || Repository::init(init_path).map(|_| ()).map_err(AppError::from))
        .await?;
    let canonical = util::canonical(&path)?;
    let canonical_str = canonical.to_string_lossy().to_string();
    let info = blocking_read(move || repo_info_inner(&canonical_str)).await?;
    crate::settings::remember(&state, &info);
    crate::watcher::watch(&app, &state, &info.path)?;
    state.sessions.ensure(&info.path);
    Ok(info)
}

#[tauri::command]
pub async fn repo_discover(root: String) -> Result<Vec<String>, AppError> {
    blocking_read(move || repo_discover_impl(root)).await
}

fn repo_discover_impl(root: String) -> Result<Vec<String>, AppError> {
    let mut out = Vec::new();
    walk_repos(Path::new(&root), 3, &mut out);
    Ok(out)
}

fn walk_repos(dir: &Path, depth: usize, out: &mut Vec<String>) {
    if out.len() >= 100 || depth == 0 {
        return;
    }
    let git = dir.join(".git");
    if git.is_dir() || git.is_file() {
        out.push(dir.to_string_lossy().to_string());
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "node_modules" || name == "target" {
                continue;
            }
            walk_repos(&path, depth - 1, out);
        }
    }
}

#[tauri::command]
pub async fn status_get(path: String) -> Result<StatusDto, AppError> {
    blocking_read(move || status_get_impl(path)).await
}

pub(crate) fn status_get_impl(path: String) -> Result<StatusDto, AppError> {
    let repo = util::open_repo(&path)?;
    let mut opts = util::status_options();
    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = Vec::new();
    for entry in statuses.iter() {
        let status = entry.status();
        let file_path = String::from_utf8_lossy(entry.path_bytes()).to_string();
        let old_path = entry
            .head_to_index()
            .and_then(|d| d.old_file().path().map(|p| p.to_string_lossy().to_string()))
            .or_else(|| {
                entry
                    .index_to_workdir()
                    .and_then(|d| d.old_file().path().map(|p| p.to_string_lossy().to_string()))
            })
            .filter(|p| p != &file_path);
        let index = util::index_state(status).to_string();
        let worktree = util::worktree_state(status).to_string();
        let conflicted = status.contains(git2::Status::CONFLICTED);
        files.push(FileStatus {
            path: file_path,
            old_path,
            staged: index != "unmodified",
            unstaged: worktree != "unmodified",
            index,
            worktree,
            conflicted,
        });
    }

    let head = repo.head().ok();
    let detached = head.as_ref().map(|h| !h.is_branch()).unwrap_or(false);
    let branch = if detached {
        None
    } else {
        head.as_ref().and_then(|h| h.shorthand().map(|s| s.to_string()))
    };
    let head_oid = head.as_ref().and_then(|h| h.target()).map(|o| o.to_string());
    let mut upstream = None;
    let mut ahead = 0usize;
    let mut behind = 0usize;
    if let Some(branch_name) = &branch {
        if let Ok(local) = repo.find_branch(branch_name, git2::BranchType::Local) {
            if let Ok(up) = local.upstream() {
                upstream = up.name().ok().flatten().map(|s| s.to_string());
                if let (Some(local_oid), Some(up_oid)) = (local.get().target(), up.get().target()) {
                    if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, up_oid) {
                        ahead = a;
                        behind = b;
                    }
                }
            }
        }
    }

    Ok(StatusDto {
        branch,
        upstream,
        ahead,
        behind,
        head_short: head_oid.as_ref().map(|o| util::short(o)),
        head_oid,
        detached,
        clean: files.is_empty(),
        state: util::state_string(repo.state()),
        files,
    })
}

pub enum DiffSource {
    Workdir,
    Staged,
    Commit(String),
}

pub fn build_diff<'repo>(
    repo: &'repo Repository,
    source: &DiffSource,
    ignore_whitespace: bool,
) -> Result<Diff<'repo>, AppError> {
    let mut opts = DiffOptions::new();
    opts.context_lines(3)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .show_untracked_content(true)
        .include_typechange(true)
        .ignore_whitespace(ignore_whitespace);
    let mut diff = match source {
        DiffSource::Workdir => repo.diff_index_to_workdir(None, Some(&mut opts))?,
        DiffSource::Staged => {
            let tree = util::head_tree(repo);
            repo.diff_tree_to_index(tree.as_ref(), None, Some(&mut opts))?
        }
        DiffSource::Commit(oid) => {
            let commit = repo.find_commit(Oid::from_str(oid)?)?;
            let new_tree = commit.tree()?;
            let old_tree = if commit.parent_count() > 0 {
                Some(commit.parent(0)?.tree()?)
            } else {
                None
            };
            repo.diff_tree_to_tree(old_tree.as_ref(), Some(&new_tree), Some(&mut opts))?
        }
    };
    let mut find = DiffFindOptions::new();
    find.renames(true).copies(false);
    diff.find_similar(Some(&mut find))?;
    Ok(diff)
}

pub fn delta_status(delta: Delta) -> &'static str {
    match delta {
        Delta::Added | Delta::Untracked => "added",
        Delta::Deleted => "deleted",
        Delta::Modified => "modified",
        Delta::Renamed => "renamed",
        Delta::Typechange => "typechange",
        Delta::Conflicted => "conflicted",
        Delta::Copied => "copied",
        _ => "modified",
    }
}

pub fn build_diff_dtos(diff: &Diff<'_>, target: Option<&str>) -> Result<Vec<DiffDto>, AppError> {
    let mut out = Vec::new();
    for idx in 0..diff.deltas().len() {
        let delta = diff.get_delta(idx).unwrap();
        let new_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let old_path = delta
            .old_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let file_path = new_path
            .clone()
            .or_else(|| old_path.clone())
            .unwrap_or_default();
        if let Some(t) = target {
            if file_path != t && old_path.as_deref() != Some(t) {
                continue;
            }
        }
        let status = delta_status(delta.status());
        let mut dto = DiffDto {
            path: file_path,
            old_path: old_path.filter(|p| Some(p) != new_path.as_ref()),
            status: status.to_string(),
            binary: false,
            additions: 0,
            deletions: 0,
            hunks: Vec::new(),
        };
        let patch = Patch::from_diff(diff, idx)?;
        match patch {
            Some(patch) => {
                if delta.flags().contains(git2::DiffFlags::BINARY) {
                    dto.binary = true;
                } else {
                    for hi in 0..patch.num_hunks() {
                        let (hunk, count) = patch.hunk(hi)?;
                        let mut lines = Vec::with_capacity(count);
                        for li in 0..count {
                            let line = patch.line_in_hunk(hi, li)?;
                            let origin = line.origin();
                            let kind = match origin {
                                '+' => "add",
                                '-' => "del",
                                _ => "context",
                            };
                            if origin == '+' {
                                dto.additions += 1;
                            } else if origin == '-' {
                                dto.deletions += 1;
                            }
                            lines.push(DiffLineDto {
                                kind: kind.to_string(),
                                old_line_no: line.old_lineno(),
                                new_line_no: line.new_lineno(),
                                content: String::from_utf8_lossy(line.content())
                                    .trim_end_matches('\n')
                                    .trim_end_matches('\r')
                                    .to_string(),
                            });
                        }
                        dto.hunks.push(HunkDto {
                            header: String::from_utf8_lossy(hunk.header())
                                .trim_end()
                                .to_string(),
                            old_start: hunk.old_start(),
                            old_lines: hunk.old_lines(),
                            new_start: hunk.new_start(),
                            new_lines: hunk.new_lines(),
                            lines,
                        });
                    }
                }
            }
            None => {
                dto.binary = true;
            }
        }
        out.push(dto);
    }
    Ok(out)
}

#[tauri::command]
pub async fn diff_workdir(
    path: String,
    file: String,
    staged: bool,
    ignore_whitespace: Option<bool>,
) -> Result<DiffDto, AppError> {
    blocking_read(move || diff_workdir_impl(path, file, staged, ignore_whitespace)).await
}

pub(crate) fn diff_workdir_impl(
    path: String,
    file: String,
    staged: bool,
    ignore_whitespace: Option<bool>,
) -> Result<DiffDto, AppError> {
    let repo = util::open_repo(&path)?;
    let source = if staged {
        DiffSource::Staged
    } else {
        DiffSource::Workdir
    };
    let diff = build_diff(&repo, &source, ignore_whitespace.unwrap_or(false))?;
    let mut list = build_diff_dtos(&diff, Some(&file))?;
    list.pop()
        .ok_or_else(|| AppError::not_found(format!("未找到该文件的差异：{file}")))
}

#[tauri::command]
pub async fn diff_commit(
    path: String,
    oid: String,
    file: String,
    ignore_whitespace: Option<bool>,
) -> Result<DiffDto, AppError> {
    blocking_read(move || diff_commit_impl(path, oid, file, ignore_whitespace)).await
}

fn diff_commit_impl(
    path: String,
    oid: String,
    file: String,
    ignore_whitespace: Option<bool>,
) -> Result<DiffDto, AppError> {
    let repo = util::open_repo(&path)?;
    let diff = build_diff(
        &repo,
        &DiffSource::Commit(oid),
        ignore_whitespace.unwrap_or(false),
    )?;
    let mut list = build_diff_dtos(&diff, Some(&file))?;
    list.pop()
        .ok_or_else(|| AppError::not_found(format!("未找到该文件的差异：{file}")))
}

fn refs_for(repo: &Repository, oid: Oid) -> Vec<CommitRef> {
    let mut refs = Vec::new();
    if let Ok(head) = repo.head() {
        if head.target() == Some(oid) {
            refs.push(CommitRef {
                name: "HEAD".to_string(),
                kind: "head".to_string(),
            });
        }
    }
    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            let Ok(commit) = reference.peel_to_commit() else {
                continue;
            };
            if commit.id() != oid {
                continue;
            }
            let name = reference.shorthand().unwrap_or("").to_string();
            if name.is_empty() || name == "HEAD" {
                continue;
            }
            let kind = if reference.is_tag() {
                "tag"
            } else if reference.is_remote() {
                "remote"
            } else {
                "branch"
            };
            refs.push(CommitRef {
                name,
                kind: kind.to_string(),
            });
        }
    }
    refs
}

fn commit_dto(repo: &Repository, commit: &git2::Commit<'_>) -> CommitDto {
    let oid = commit.id().to_string();
    CommitDto {
        short_oid: util::short(&oid),
        oid,
        parents: commit.parent_ids().map(|p| p.to_string()).collect(),
        author_name: commit.author().name().unwrap_or("").to_string(),
        author_email: commit.author().email().unwrap_or("").to_string(),
        time: commit.time().seconds(),
        subject: commit.summary().unwrap_or("").to_string(),
        body: commit.body().unwrap_or("").to_string(),
        refs: refs_for(repo, commit.id()),
    }
}

fn parse_refs(raw: &str) -> Vec<CommitRef> {
    let mut refs = Vec::new();
    for part in raw.split(',') {
        let name = part.trim();
        if name.is_empty() {
            continue;
        }
        let (name, kind) = if let Some(rest) = name.strip_prefix("tag: ") {
            (rest.to_string(), "tag")
        } else if let Some(rest) = name.strip_prefix("HEAD -> ") {
            (rest.to_string(), "head")
        } else if name.contains('/') {
            (name.to_string(), "remote")
        } else {
            (name.to_string(), "branch")
        };
        refs.push(CommitRef {
            name,
            kind: kind.to_string(),
        });
    }
    refs
}

#[tauri::command]
pub async fn log_query(path: String, query: LogQuery) -> Result<CommitPage, AppError> {
    let repo = util::open_repo(&path)?;
    let has_head = repo.head().is_ok();
    drop(repo);
    if !has_head {
        return Ok(CommitPage {
            commits: Vec::new(),
            has_more: false,
        });
    }
    let limit = if query.limit == 0 { 500 } else { query.limit };
    let mut args: Vec<String> = vec![
        "-c".into(),
        "core.quotepath=false".into(),
        "log".into(),
        "--date-order".into(),
        format!("--format={LOG_FORMAT}"),
        "-n".into(),
        limit.to_string(),
        "--skip".into(),
        query.skip.to_string(),
    ];
    if let Some(author) = &query.author {
        if !author.trim().is_empty() {
            args.push(format!("--author={author}"));
        }
    }
    if let Some(text) = &query.query {
        if !text.trim().is_empty() {
            args.push("--fixed-strings".into());
            args.push(format!("--grep={text}"));
            args.push("-i".into());
        }
    }
    args.push(query.rev.clone().unwrap_or_else(|| "HEAD".to_string()));
    if let Some(file) = &query.file {
        args.push("--".into());
        args.push(file.clone());
    }
    let output = util::git(&path, &args).await?;
    let mut commits = Vec::new();
    for record in output.split('\u{1e}') {
        let record = record.trim_matches(|c| c == '\n' || c == '\r');
        if record.is_empty() {
            continue;
        }
        let fields: Vec<&str> = record.split('\u{1f}').collect();
        if fields.len() < 9 {
            continue;
        }
        commits.push(CommitDto {
            oid: fields[0].to_string(),
            short_oid: fields[1].to_string(),
            parents: fields[2]
                .split_whitespace()
                .map(|s| s.to_string())
                .collect(),
            author_name: fields[3].to_string(),
            author_email: fields[4].to_string(),
            time: fields[5].parse().unwrap_or(0),
            subject: fields[6].to_string(),
            body: fields[8].trim().to_string(),
            refs: parse_refs(fields[7]),
        });
    }
    let has_more = commits.len() == limit;
    Ok(CommitPage { commits, has_more })
}

#[tauri::command]
pub async fn file_history(
    path: String,
    file: String,
    limit: Option<usize>,
) -> Result<CommitPage, AppError> {
    log_query(
        path,
        LogQuery {
            rev: None,
            limit: limit.unwrap_or(100),
            skip: 0,
            author: None,
            query: None,
            file: Some(file),
        },
    )
    .await
}

#[tauri::command]
pub async fn commit_detail(path: String, oid: String) -> Result<CommitDetail, AppError> {
    blocking_read(move || commit_detail_impl(path, oid)).await
}

fn commit_detail_impl(path: String, oid: String) -> Result<CommitDetail, AppError> {
    let repo = util::open_repo(&path)?;
    let oid_parsed = Oid::from_str(&oid)?;
    let commit = repo.find_commit(oid_parsed)?;
    let dto = commit_dto(&repo, &commit);
    let diff = build_diff(&repo, &DiffSource::Commit(oid), false)?;
    let mut files = Vec::new();
    for idx in 0..diff.deltas().len().min(500) {
        let delta = diff.get_delta(idx).unwrap();
        let new_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let old_path = delta
            .old_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let file_path = new_path
            .clone()
            .or_else(|| old_path.clone())
            .unwrap_or_default();
        let patch = Patch::from_diff(&diff, idx)?;
        let (additions, deletions, binary) = match patch {
            Some(p) => {
                let (_, adds, dels) = p.line_stats()?;
                (adds, dels, false)
            }
            None => (0, 0, true),
        };
        files.push(FileChange {
            path: file_path,
            old_path: old_path.filter(|p| Some(p) != new_path.as_ref()),
            status: delta_status(delta.status()).to_string(),
            additions,
            deletions,
            binary,
        });
    }
    Ok(CommitDetail { commit: dto, files })
}

#[tauri::command]
pub async fn branches_list(path: String) -> Result<Vec<BranchDto>, AppError> {
    blocking_read(move || branches_list_impl(path)).await
}

fn branches_list_impl(path: String) -> Result<Vec<BranchDto>, AppError> {
    let repo = util::open_repo(&path)?;
    let mut out = Vec::new();
    for branch in repo.branches(None)?.flatten() {
        let (branch, branch_type) = branch;
        let Some(name) = branch.name().ok().flatten().map(|s| s.to_string()) else {
            continue;
        };
        if name.ends_with("/HEAD") {
            continue;
        }
        let is_remote = branch_type == git2::BranchType::Remote;
        let is_head = branch.is_head();
        let mut upstream = None;
        let mut ahead = 0usize;
        let mut behind = 0usize;
        let mut oid = String::new();
        let mut subject = String::new();
        if let Ok(commit) = branch.get().peel_to_commit() {
            oid = commit.id().to_string();
            subject = commit.summary().unwrap_or("").to_string();
        }
        if !is_remote {
            if let Ok(up) = branch.upstream() {
                upstream = up.name().ok().flatten().map(|s| s.to_string());
                if let (Some(local_oid), Some(up_oid)) = (branch.get().target(), up.get().target()) {
                    if let Ok((a, b)) = repo.graph_ahead_behind(local_oid, up_oid) {
                        ahead = a;
                        behind = b;
                    }
                }
            }
        }
        out.push(BranchDto {
            short_oid: util::short(&oid),
            name,
            is_remote,
            is_head,
            upstream,
            ahead,
            behind,
            oid,
            subject,
        });
    }
    out.sort_by(|a, b| {
        b.is_head
            .cmp(&a.is_head)
            .then(a.is_remote.cmp(&b.is_remote))
            .then(a.name.cmp(&b.name))
    });
    Ok(out)
}

#[tauri::command]
pub async fn tags_list(path: String) -> Result<Vec<TagDto>, AppError> {
    blocking_read(move || tags_list_impl(path)).await
}

fn tags_list_impl(path: String) -> Result<Vec<TagDto>, AppError> {
    let repo = util::open_repo(&path)?;
    let mut out = Vec::new();
    if let Ok(names) = repo.tag_names(None) {
        for name in names.iter().flatten() {
            let Ok(reference) = repo.find_reference(&format!("refs/tags/{name}")) else {
                continue;
            };
            let Ok(commit) = reference.peel_to_commit() else {
                continue;
            };
            let oid = commit.id().to_string();
            let mut message = None;
            let mut time = None;
            let mut annotated = false;
            if let Some(target) = reference.target() {
                if let Ok(tag) = repo.find_tag(target) {
                    annotated = true;
                    message = tag.message().map(|s| s.to_string());
                    time = tag.tagger().map(|s| s.when().seconds());
                }
            }
            out.push(TagDto {
                name: name.to_string(),
                short_oid: util::short(&oid),
                oid,
                message,
                time,
                annotated,
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[tauri::command]
pub async fn remote_list(path: String) -> Result<Vec<RemoteDto>, AppError> {
    blocking_read(move || remote_list_impl(path)).await
}

fn remote_list_impl(path: String) -> Result<Vec<RemoteDto>, AppError> {
    let repo = util::open_repo(&path)?;
    let mut out = Vec::new();
    if let Ok(names) = repo.remotes() {
        for name in names.iter().flatten() {
            let url = repo
                .find_remote(name)
                .ok()
                .and_then(|r| r.url().map(|s| s.to_string()))
                .unwrap_or_default();
            out.push(RemoteDto {
                name: name.to_string(),
                url,
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn stash_list(path: String) -> Result<Vec<StashDto>, AppError> {
    let output = util::git(
        &path,
        &["stash", "list", "--format=%gd%x1f%H%x1f%ct%x1f%gs"],
    )
    .await?;
    let mut out = Vec::new();
    for line in output.lines() {
        let fields: Vec<&str> = line.split('\u{1f}').collect();
        if fields.len() < 4 {
            continue;
        }
        let index = fields[0]
            .trim_start_matches("stash@{")
            .trim_end_matches('}')
            .parse()
            .unwrap_or(0);
        let oid = fields[1].to_string();
        out.push(StashDto {
            index,
            short_oid: util::short(&oid),
            oid,
            time: fields[2].parse().unwrap_or(0),
            message: fields[3].to_string(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn stash_diff(path: String, oid: String) -> Result<Vec<DiffDto>, AppError> {
    blocking_read(move || stash_diff_impl(path, oid)).await
}

fn stash_diff_impl(path: String, oid: String) -> Result<Vec<DiffDto>, AppError> {
    let repo = util::open_repo(&path)?;
    let commit = repo.find_commit(Oid::from_str(&oid)?)?;
    let new_tree = commit.tree()?;
    let old_tree = commit.parent(0)?.tree()?;
    let mut opts = DiffOptions::new();
    opts.context_lines(3);
    let mut diff =
        repo.diff_tree_to_tree(Some(&old_tree), Some(&new_tree), Some(&mut opts))?;
    let mut find = DiffFindOptions::new();
    find.renames(true);
    diff.find_similar(Some(&mut find))?;
    build_diff_dtos(&diff, None)
}

#[tauri::command]
pub async fn blame_get(
    path: String,
    file: String,
    rev: Option<String>,
) -> Result<Vec<BlameLine>, AppError> {
    blocking_read(move || blame_get_impl(path, file, rev)).await
}

fn blame_get_impl(
    path: String,
    file: String,
    rev: Option<String>,
) -> Result<Vec<BlameLine>, AppError> {
    let repo = util::open_repo(&path)?;
    let mut opts = BlameOptions::new();
    if let Some(rev) = &rev {
        if let Ok(obj) = repo.revparse_single(rev) {
            if let Ok(commit) = obj.peel_to_commit() {
                opts.newest_commit(commit.id());
            }
        }
    }
    let blame = repo.blame_file(Path::new(&file), Some(&mut opts))?;
    let content = util::workdir_content(&repo, &file).unwrap_or_default();
    let lines: Vec<&str> = content.split('\n').collect();
    let mut out = Vec::new();
    for hunk in blame.iter() {
        let start = hunk.final_start_line();
        let count = hunk.lines_in_hunk();
        let oid = hunk.orig_commit_id().to_string();
        let signature = hunk.final_signature();
        let author = signature.name().map(|n| n.to_string()).unwrap_or_default();
        let time = signature.when().seconds();
        for offset in 0..count {
            let line_no = start + offset;
            out.push(BlameLine {
                line_no,
                short_oid: util::short(&oid),
                oid: oid.clone(),
                author: author.clone(),
                time,
                content: lines.get(line_no.saturating_sub(1)).unwrap_or(&"").to_string(),
            });
            if out.len() >= 20000 {
                return Ok(out);
            }
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn conflict_list(path: String) -> Result<Vec<ConflictFile>, AppError> {
    blocking_read(move || conflict_list_impl(path)).await
}

fn conflict_list_impl(path: String) -> Result<Vec<ConflictFile>, AppError> {
    let repo = util::open_repo(&path)?;
    let index = repo.index()?;
    let mut paths = BTreeMap::new();
    for conflict in index.conflicts()? {
        let conflict = conflict?;
        let entry = conflict
            .our
            .as_ref()
            .or(conflict.their.as_ref())
            .or(conflict.ancestor.as_ref());
        if let Some(entry) = entry {
            let file_path = String::from_utf8_lossy(&entry.path).to_string();
            paths.insert(file_path, ());
        }
    }
    let mut out = Vec::new();
    for file_path in paths.keys() {
        let read_stage = |stage: i32| -> Option<String> {
            let entry = index.get_path(Path::new(file_path), stage)?;
            let blob = repo.find_blob(entry.id).ok()?;
            Some(String::from_utf8_lossy(blob.content()).to_string())
        };
        let ours = read_stage(2);
        let theirs = read_stage(3);
        let base = read_stage(1);
        let result = util::workdir_content(&repo, file_path).unwrap_or_default();
        let binary = ours.as_deref().map(|c| c.contains('\u{0}')).unwrap_or(false)
            || theirs.as_deref().map(|c| c.contains('\u{0}')).unwrap_or(false)
            || base.as_deref().map(|c| c.contains('\u{0}')).unwrap_or(false)
            || result.contains('\u{0}');
        out.push(ConflictFile {
            path: file_path.clone(),
            ours,
            theirs,
            base,
            result,
            binary,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn submodule_list(path: String) -> Result<Vec<SubmoduleDto>, AppError> {
    blocking_read(move || submodule_list_impl(path)).await
}

fn submodule_list_impl(path: String) -> Result<Vec<SubmoduleDto>, AppError> {
    let repo = util::open_repo(&path)?;
    let mut out = Vec::new();
    for submodule in repo.submodules()? {
        let name = submodule.name().unwrap_or("").to_string();
        let status = repo.submodule_status(&name, git2::SubmoduleIgnore::None)?;
        let label = if status.contains(git2::SubmoduleStatus::WD_WD_MODIFIED)
            || status.contains(git2::SubmoduleStatus::WD_INDEX_MODIFIED)
        {
            "modified"
        } else if status.contains(git2::SubmoduleStatus::WD_UNTRACKED) {
            "untracked"
        } else if status.contains(git2::SubmoduleStatus::IN_WD) {
            "clean"
        } else {
            "uninitialized"
        };
        out.push(SubmoduleDto {
            name,
            path: submodule.path().to_string_lossy().to_string(),
            url: submodule.url().unwrap_or("").to_string(),
            head_oid: submodule.head_id().map(|o| o.to_string()),
            status: label.to_string(),
        });
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

#[tauri::command]
pub async fn worktree_list(path: String) -> Result<Vec<WorktreeDto>, AppError> {
    let output = util::git(&path, &["worktree", "list", "--porcelain"]).await?;
    let mut out = Vec::new();
    let mut current = WorktreeDto {
        path: String::new(),
        head: None,
        branch: None,
        bare: false,
        detached: false,
    };
    let push = |item: &mut WorktreeDto, out: &mut Vec<WorktreeDto>| {
        if !item.path.is_empty() {
            out.push(std::mem::replace(
                item,
                WorktreeDto {
                    path: String::new(),
                    head: None,
                    branch: None,
                    bare: false,
                    detached: false,
                },
            ));
        }
    };
    for line in output.lines() {
        if line.trim().is_empty() {
            push(&mut current, &mut out);
            continue;
        }
        if let Some(rest) = line.strip_prefix("worktree ") {
            push(&mut current, &mut out);
            current.path = rest.to_string();
        } else if let Some(rest) = line.strip_prefix("HEAD ") {
            current.head = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("branch ") {
            current.branch = Some(rest.trim_start_matches("refs/heads/").to_string());
        } else if line == "bare" {
            current.bare = true;
        } else if line == "detached" {
            current.detached = true;
        }
    }
    push(&mut current, &mut out);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::{blocking_read, repo_close_inner};
    use crate::session::RepoRegistry;
    use crate::{settings::Settings, AppState};
    use notify::recommended_watcher;
    use std::sync::Mutex;

    #[test]
    fn repo_close_releases_watcher_and_session() {
        let state = AppState {
            settings: Mutex::new(Settings::default()),
            watchers: Mutex::new(Default::default()),
            sessions: RepoRegistry::default(),
        };
        let repo_id = "/tmp/giteasy-close-test";
        state.sessions.ensure(repo_id);
        let watcher = recommended_watcher(|_| {}).unwrap();
        state
            .watchers
            .lock()
            .unwrap()
            .insert(repo_id.to_string(), watcher);

        repo_close_inner(&state, repo_id);

        assert!(state.sessions.get(repo_id).is_none());
        assert!(!state.watchers.lock().unwrap().contains_key(repo_id));
    }

    #[tokio::test]
    async fn blocking_read_returns_task_result() {
        let value = blocking_read(|| Ok(42)).await.unwrap();
        assert_eq!(value, 42);
    }
}
