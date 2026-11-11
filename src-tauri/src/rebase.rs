use crate::error::AppError;
use crate::model::{ProgressEvent, RebaseCommit, RebaseStep};
use crate::util;
use crate::write::run_stream_env;
use std::path::PathBuf;
use tauri::{ipc::Channel, State};

const ALLOWED_ACTIONS: [&str; 5] = ["pick", "reword", "squash", "fixup", "drop"];

fn temp_path(tag: &str) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "giteasy-rebase-{}-{}-{}",
        std::process::id(),
        nanos,
        tag
    ))
}

fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

pub(crate) fn build_todo(
    steps: &[RebaseStep],
    message_paths: &[Option<PathBuf>],
) -> Result<String, AppError> {
    let mut todo = String::new();
    let mut first: Option<&RebaseStep> = None;
    for (index, step) in steps.iter().enumerate() {
        if !ALLOWED_ACTIONS.contains(&step.action.as_str()) {
            return Err(AppError::user(format!("不支持的变基动作：{}", step.action)));
        }
        if first.is_none() && step.action != "drop" {
            first = Some(step);
        }
        match step.action.as_str() {
            "pick" | "squash" | "fixup" | "drop" => {
                todo.push_str(&format!("{} {}\n", step.action, step.oid));
            }
            "reword" => {
                let message = step
                    .message
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| AppError::user("改写提交信息时不能为空"))?;
                let path = message_paths
                    .get(index)
                    .and_then(|value| value.as_ref())
                    .ok_or_else(|| AppError::user("缺少提交信息临时文件"))?;
                let _ = message;
                todo.push_str(&format!("pick {}\n", step.oid));
                todo.push_str(&format!(
                    "exec git commit --amend --no-verify -F {}\n",
                    quote(path.to_string_lossy().as_ref())
                ));
            }
            _ => {}
        }
    }
    match first {
        None => Err(AppError::user("至少保留一个提交")),
        Some(step) if step.action == "squash" || step.action == "fixup" => {
            Err(AppError::user("第一个提交不能使用 squash 或 fixup"))
        }
        Some(_) => Ok(todo),
    }
}

#[tauri::command]
pub async fn rebase_todo(path: String, base: String) -> Result<Vec<RebaseCommit>, AppError> {
    if base.trim().is_empty() {
        return Err(AppError::user("请选择变基的基点提交"));
    }
    let range = format!("{base}..HEAD");
    let output = util::git_trimmed(
        &path,
        &[
            "log",
            "--no-merges",
            "--max-count=200",
            "--format=%H%x1f%h%x1f%s",
            range.as_str(),
        ],
    )
    .await?;
    let mut commits = Vec::new();
    for line in output.lines() {
        let mut parts = line.splitn(3, '\u{1f}');
        let oid = parts.next().unwrap_or("").trim();
        if oid.is_empty() {
            continue;
        }
        let short_oid = parts.next().unwrap_or("").trim().to_string();
        let subject = parts.next().unwrap_or("").trim().to_string();
        commits.push(RebaseCommit {
            oid: oid.to_string(),
            short_oid,
            subject,
        });
    }
    commits.reverse();
    Ok(commits)
}

#[tauri::command]
pub async fn rebase_start(
    state: State<'_, crate::AppState>,
    path: String,
    base: String,
    steps: Vec<RebaseStep>,
    backup: bool,
    on_event: Channel<ProgressEvent>,
) -> Result<Option<String>, AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    if base.trim().is_empty() {
        return Err(AppError::user("请选择变基的基点提交"));
    }
    if steps.is_empty() {
        return Err(AppError::user("没有需要变基的提交"));
    }
    let mut message_paths: Vec<Option<PathBuf>> = Vec::with_capacity(steps.len());
    for (index, step) in steps.iter().enumerate() {
        if step.action == "reword" {
            let message = step.message.clone().unwrap_or_default();
            if message.trim().is_empty() {
                return Err(AppError::user("改写提交信息时不能为空"));
            }
            let message_path = temp_path(&format!("msg-{index}.txt"));
            std::fs::write(&message_path, message)?;
            message_paths.push(Some(message_path));
        } else {
            message_paths.push(None);
        }
    }
    let todo = build_todo(&steps, &message_paths)?;
    let backup_tag = if backup {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_secs())
            .unwrap_or(0);
        let tag = format!("giteasy-backup-{stamp}");
        util::git(&path, &["tag", tag.as_str(), "HEAD"]).await?;
        Some(tag)
    } else {
        None
    };
    let todo_path = temp_path("plan.todo");
    std::fs::write(&todo_path, todo)?;
    let editor = format!("cp {}", quote(todo_path.to_string_lossy().as_ref()));
    let envs = vec![
        ("GIT_SEQUENCE_EDITOR", editor),
        ("GIT_EDITOR", "true".to_string()),
    ];
    run_stream_env(
        &path,
        &["rebase", "-i", "--no-autosquash", base.as_str()],
        &envs,
        &on_event,
    )
    .await?;
    Ok(backup_tag)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_todo_with_reorder_and_reword() {
        let steps = vec![
            RebaseStep {
                action: "pick".into(),
                oid: "aaa".into(),
                message: None,
            },
            RebaseStep {
                action: "reword".into(),
                oid: "bbb".into(),
                message: Some("new message".into()),
            },
            RebaseStep {
                action: "fixup".into(),
                oid: "ccc".into(),
                message: None,
            },
            RebaseStep {
                action: "drop".into(),
                oid: "ddd".into(),
                message: None,
            },
        ];
        let paths = vec![None, Some(PathBuf::from("/tmp/giteasy-msg")), None, None];
        let todo = build_todo(&steps, &paths).unwrap();
        assert!(todo.starts_with("pick aaa\n"));
        assert!(todo.contains("pick bbb\n"));
        assert!(todo.contains("exec git commit --amend --no-verify -F '/tmp/giteasy-msg'\n"));
        assert!(todo.contains("fixup ccc\n"));
        assert!(todo.contains("drop ddd\n"));
    }

    #[test]
    fn rejects_squash_as_first_commit() {
        let steps = vec![RebaseStep {
            action: "squash".into(),
            oid: "aaa".into(),
            message: None,
        }];
        assert!(build_todo(&steps, &[None]).is_err());
    }
}
