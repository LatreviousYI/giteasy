use crate::AppState;
use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager, State, Window, WindowEvent};

pub(crate) fn cleanup(state: &AppState) -> bool {
    if state.shutting_down.swap(true, Ordering::AcqRel) {
        return false;
    }
    crate::util::lock_or_recover(&state.watchers).clear();
    state.sessions.clear();
    true
}

fn begin_shutdown(app: &tauri::AppHandle, state: &AppState) {
    if cleanup(state) {
        app.exit(0);
    }
}

pub(crate) fn on_window_event(window: &Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    api.prevent_close();

    let app = window.app_handle();
    let state = app.state::<AppState>();
    if state.shutting_down.load(Ordering::Acquire) {
        return;
    }

    let operations = state.sessions.active_operations();
    if operations == 0 {
        begin_shutdown(app, state.inner());
        return;
    }

    if let Err(error) = window.emit(
        "app://close-requested",
        serde_json::json!({ "operations": operations }),
    ) {
        eprintln!("failed to request close confirmation: {error}");
    }
}

#[tauri::command]
pub fn app_exit(app: tauri::AppHandle, state: State<'_, AppState>) {
    begin_shutdown(&app, state.inner());
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{github, session, settings};
    use notify::recommended_watcher;
    use std::collections::HashMap;
    use std::sync::atomic::AtomicBool;
    use std::sync::Mutex;

    fn test_state() -> AppState {
        AppState {
            settings: Mutex::new(settings::Settings::default()),
            watchers: Mutex::new(HashMap::new()),
            sessions: session::RepoRegistry::default(),
            github: github::GitHubService::new(),
            shutting_down: AtomicBool::new(false),
        }
    }

    #[test]
    fn cleanup_releases_watchers_and_sessions_once() {
        let state = test_state();
        let watcher = recommended_watcher(|_| {}).unwrap();
        crate::util::lock_or_recover(&state.watchers)
            .insert("/tmp/shutdown-repo".to_string(), watcher);
        state.sessions.ensure("/tmp/shutdown-repo");

        assert!(cleanup(&state));
        assert!(crate::util::lock_or_recover(&state.watchers).is_empty());
        assert!(state.sessions.get("/tmp/shutdown-repo").is_none());
        assert!(state.shutting_down.load(Ordering::Acquire));
        assert!(!cleanup(&state));
    }
}
