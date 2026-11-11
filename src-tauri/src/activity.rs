use crate::error::AppError;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::ffi::OsStr;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_EVENTS_PER_REPO: usize = 200;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEvent {
    pub id: u64,
    pub repo_path: String,
    pub command: String,
    pub status: String,
    pub started_at: i64,
    pub finished_at: i64,
    pub duration_ms: u64,
    pub summary: String,
    pub output: Option<String>,
    pub error: Option<String>,
}

#[derive(Default)]
struct ActivityStore {
    next_id: u64,
    by_repo: HashMap<String, VecDeque<ActivityEvent>>,
}

fn store() -> &'static Mutex<ActivityStore> {
    static STORE: OnceLock<Mutex<ActivityStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(ActivityStore::default()))
}

pub fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as i64)
        .unwrap_or(0)
}

pub fn command_text<S: AsRef<OsStr>>(program: &str, args: &[S]) -> String {
    let mut parts = Vec::with_capacity(args.len() + 1);
    parts.push(program.to_string());
    parts.extend(
        args.iter()
            .map(|value| value.as_ref().to_string_lossy().to_string()),
    );
    redact(&parts.join(" "))
}

pub fn record_success(
    repo_path: &str,
    command: &str,
    started_at: i64,
    duration_ms: u64,
    stdout: &str,
    stderr: &str,
) {
    let output = [stdout.trim(), stderr.trim()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    let summary = output
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| truncate(&redact(line), 240))
        .unwrap_or_else(|| "操作完成".to_string());
    push(ActivityEvent {
        id: 0,
        repo_path: repo_key(repo_path),
        command: redact(command),
        status: "success".to_string(),
        started_at,
        finished_at: now_millis(),
        duration_ms,
        summary,
        output: (!output.is_empty()).then(|| redact(&truncate(&output, 16_000))),
        error: None,
    });
}

pub fn record_error(
    repo_path: &str,
    command: &str,
    started_at: i64,
    duration_ms: u64,
    error: &AppError,
) {
    let detail = error.detail.as_deref().unwrap_or_default();
    push(ActivityEvent {
        id: 0,
        repo_path: repo_key(repo_path),
        command: redact(command),
        status: "error".to_string(),
        started_at,
        finished_at: now_millis(),
        duration_ms,
        summary: truncate(&redact(&error.message), 240),
        output: None,
        error: Some(redact(&truncate(detail, 16_000))),
    });
}

fn push(mut event: ActivityEvent) {
    let mut store = store()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    store.next_id = store.next_id.saturating_add(1);
    event.id = store.next_id;
    let events = store
        .by_repo
        .entry(event.repo_path.clone())
        .or_default();
    events.push_back(event);
    while events.len() > MAX_EVENTS_PER_REPO {
        events.pop_front();
    }
}

#[tauri::command]
pub fn activity_list(
    path: String,
    limit: Option<usize>,
) -> Result<Vec<ActivityEvent>, AppError> {
    let key = repo_key(&path);
    let store = store()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let limit = limit.unwrap_or(100).clamp(1, MAX_EVENTS_PER_REPO);
    Ok(store
        .by_repo
        .get(&key)
        .map(|events| events.iter().rev().take(limit).cloned().collect())
        .unwrap_or_default())
}

fn repo_key(path: &str) -> String {
    std::fs::canonicalize(path)
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.to_string())
}

fn truncate(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut truncated: String = value.chars().take(max_chars.saturating_sub(1)).collect();
    truncated.push('…');
    truncated
}

pub fn redact(value: &str) -> String {
    value
        .split_whitespace()
        .map(|part| {
            let Some(scheme) = part.find("://") else {
                return part.to_string();
            };
            let authority_start = scheme + 3;
            let remainder = &part[authority_start..];
            let Some(at) = remainder.find('@') else {
                return part.to_string();
            };
            let userinfo = &remainder[..at];
            if !userinfo.contains(':') {
                return part.to_string();
            }
            format!("{}***@{}", &part[..authority_start], &remainder[at + 1..])
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::{activity_list, record_error, record_success, redact};
    use crate::error::AppError;

    #[test]
    fn activity_is_kept_per_repository_newest_first() {
        let repo = "/tmp/giteasy-activity-test";
        record_success(repo, "git status", 1, 5, "clean", "");
        record_error(
            repo,
            "git fetch",
            2,
            7,
            &AppError::git("network failed", "details"),
        );

        let events = activity_list(repo.to_string(), Some(2)).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].status, "error");
        assert_eq!(events[1].status, "success");
    }

    #[test]
    fn credentials_are_redacted() {
        let redacted = redact("git clone https://name:secret@example.com/repo.git");
        assert!(!redacted.contains("secret"));
        assert!(redacted.contains("https://***@example.com/repo.git"));
    }
}
