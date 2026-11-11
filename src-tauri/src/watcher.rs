use crate::error::AppError;
use notify::{recommended_watcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

pub fn watch(app: &tauri::AppHandle, state: &crate::AppState, path: &str) -> Result<(), AppError> {
    let mut watchers = state.watchers.lock().unwrap();
    if watchers.contains_key(path) {
        return Ok(());
    }

    let app = app.clone();
    let repo_path = path.to_string();
    let last_emit = Arc::new(AtomicI64::new(0));

    let mut watcher = recommended_watcher(move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else { return };
        if matches!(event.kind, notify::EventKind::Access(_)) {
            return;
        }
        let relevant = event.paths.iter().any(|p| {
            let text = p.to_string_lossy();
            !text.contains("/.git/objects/")
                && !text.contains("/.git/logs/")
                && !text.contains("/node_modules/")
                && !text.contains("/target/")
                && !text.ends_with(".lock")
        });
        if !relevant {
            return;
        }
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        let prev = last_emit.load(Ordering::Relaxed);
        if now - prev < 250 {
            return;
        }
        last_emit.store(now, Ordering::Relaxed);
        let _ = app.emit(
            "repo://changed",
            serde_json::json!({ "repoPath": repo_path, "kind": "change" }),
        );
    })?;

    let root = Path::new(path);
    watcher.watch(root, RecursiveMode::Recursive)?;
    watchers.insert(path.to_string(), watcher);
    Ok(())
}
