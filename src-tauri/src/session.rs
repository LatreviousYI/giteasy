use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::{Mutex as AsyncMutex, OwnedMutexGuard};

pub struct RepoSession {
    repo_id: String,
    write_lock: Arc<AsyncMutex<()>>,
}

impl RepoSession {
    fn new(repo_id: String) -> Self {
        Self {
            repo_id,
            write_lock: Arc::new(AsyncMutex::new(())),
        }
    }

    pub fn repo_id(&self) -> &str {
        &self.repo_id
    }

    pub async fn acquire_write(self: &Arc<Self>) -> OwnedMutexGuard<()> {
        self.write_lock.clone().lock_owned().await
    }
}

#[derive(Default)]
pub struct RepoRegistry {
    sessions: Mutex<HashMap<String, Arc<RepoSession>>>,
}

impl RepoRegistry {
    pub fn ensure(&self, repo_id: &str) -> Arc<RepoSession> {
        let mut sessions = self
            .sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        sessions
            .entry(repo_id.to_string())
            .or_insert_with(|| Arc::new(RepoSession::new(repo_id.to_string())))
            .clone()
    }

    pub fn get(&self, repo_id: &str) -> Option<Arc<RepoSession>> {
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(repo_id)
            .cloned()
    }

    pub fn remove(&self, repo_id: &str) -> Option<Arc<RepoSession>> {
        self.sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(repo_id)
    }
}

pub async fn acquire_repo_write(
    state: &crate::AppState,
    repo_id: &str,
) -> OwnedMutexGuard<()> {
    state.sessions.ensure(repo_id).acquire_write().await
}

#[cfg(test)]
mod tests {
    use super::RepoRegistry;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    #[test]
    fn registry_reuses_the_same_session_for_a_repo_id() {
        let registry = RepoRegistry::default();
        let first = registry.ensure("/tmp/example-repo");
        let second = registry.ensure("/tmp/example-repo");

        assert!(Arc::ptr_eq(&first, &second));
        assert_eq!(first.repo_id(), "/tmp/example-repo");
    }

    #[test]
    fn registry_keeps_sessions_isolated_by_repo_id() {
        let registry = RepoRegistry::default();
        let first = registry.ensure("/tmp/repo-a");
        let second = registry.ensure("/tmp/repo-b");

        assert!(!Arc::ptr_eq(&first, &second));
        assert!(registry.get("/tmp/repo-a").is_some());
        assert!(registry.get("/tmp/missing").is_none());
        assert!(registry.remove("/tmp/repo-a").is_some());
        assert!(registry.get("/tmp/repo-a").is_none());
    }

    #[tokio::test]
    async fn same_repo_write_lock_serializes() {
        let registry = RepoRegistry::default();
        let first = registry.ensure("/tmp/shared-repo");
        let second = registry.ensure("/tmp/shared-repo");
        let acquired = Arc::new(AtomicBool::new(false));

        let guard = first.acquire_write().await;
        let task = tokio::spawn({
            let second = second.clone();
            let acquired = acquired.clone();
            async move {
                let _guard = second.acquire_write().await;
                acquired.store(true, Ordering::SeqCst);
            }
        });

        tokio::time::sleep(Duration::from_millis(20)).await;
        assert!(!acquired.load(Ordering::SeqCst));

        drop(guard);
        task.await.unwrap();
        assert!(acquired.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn different_repo_write_locks_run_independently() {
        let registry = RepoRegistry::default();
        let first = registry.ensure("/tmp/repo-one");
        let second = registry.ensure("/tmp/repo-two");
        let first_guard = first.acquire_write().await;

        let second_guard = tokio::time::timeout(
            Duration::from_millis(50),
            second.acquire_write(),
        )
        .await
        .expect("different repository lock should not wait");

        drop(second_guard);
        drop(first_guard);
    }
}
