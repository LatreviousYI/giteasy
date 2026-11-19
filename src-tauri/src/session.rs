use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
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
    active_operations: Arc<AtomicUsize>,
}

impl RepoRegistry {
    pub fn ensure(&self, repo_id: &str) -> Arc<RepoSession> {
        let mut sessions = crate::util::lock_or_recover(&self.sessions);
        sessions
            .entry(repo_id.to_string())
            .or_insert_with(|| Arc::new(RepoSession::new(repo_id.to_string())))
            .clone()
    }

    pub fn get(&self, repo_id: &str) -> Option<Arc<RepoSession>> {
        crate::util::lock_or_recover(&self.sessions)
            .get(repo_id)
            .cloned()
    }

    pub fn remove(&self, repo_id: &str) -> Option<Arc<RepoSession>> {
        crate::util::lock_or_recover(&self.sessions).remove(repo_id)
    }

    pub fn clear(&self) {
        crate::util::lock_or_recover(&self.sessions).clear();
    }

    pub fn active_operations(&self) -> usize {
        self.active_operations.load(Ordering::Acquire)
    }

    pub async fn acquire(&self, repo_id: &str) -> RepoWriteGuard {
        let operation = OperationGuard::new(self.active_operations.clone());
        let session = self.ensure(repo_id);
        let guard = session.acquire_write().await;
        RepoWriteGuard {
            _guard: guard,
            _operation: operation,
        }
    }
}

pub struct RepoWriteGuard {
    _guard: OwnedMutexGuard<()>,
    _operation: OperationGuard,
}

struct OperationGuard {
    active_operations: Arc<AtomicUsize>,
}

impl OperationGuard {
    fn new(active_operations: Arc<AtomicUsize>) -> Self {
        active_operations.fetch_add(1, Ordering::AcqRel);
        Self { active_operations }
    }
}

impl Drop for OperationGuard {
    fn drop(&mut self) {
        let previous = self.active_operations.fetch_sub(1, Ordering::AcqRel);
        debug_assert!(previous > 0, "active operation counter underflow");
        if previous == 0 {
            self.active_operations.fetch_add(1, Ordering::Relaxed);
        }
    }
}

pub async fn acquire_repo_write(state: &crate::AppState, repo_id: &str) -> RepoWriteGuard {
    state.sessions.acquire(repo_id).await
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

        let second_guard = tokio::time::timeout(Duration::from_millis(50), second.acquire_write())
            .await
            .expect("different repository lock should not wait");

        drop(second_guard);
        drop(first_guard);
    }

    #[tokio::test]
    async fn active_operation_count_tracks_guard_lifetime() {
        let registry = Arc::new(RepoRegistry::default());
        let guard = registry.acquire("/tmp/count-repo").await;
        assert_eq!(registry.active_operations(), 1);
        drop(guard);
        assert_eq!(registry.active_operations(), 0);
    }

    #[tokio::test]
    async fn waiting_writes_are_included_in_active_operations() {
        let registry = Arc::new(RepoRegistry::default());
        let first = registry.acquire("/tmp/queued-repo").await;
        let second_registry = registry.clone();
        let second = tokio::spawn(async move {
            let guard = second_registry.acquire("/tmp/queued-repo").await;
            drop(guard);
        });

        tokio::time::sleep(Duration::from_millis(20)).await;
        assert_eq!(registry.active_operations(), 2);
        drop(first);
        second.await.unwrap();
        assert_eq!(registry.active_operations(), 0);
    }

    #[test]
    fn clear_releases_sessions_without_underflowing_operation_count() {
        let registry = RepoRegistry::default();
        registry.ensure("/tmp/clear-repo");
        registry.clear();
        assert!(registry.get("/tmp/clear-repo").is_none());
        assert_eq!(registry.active_operations(), 0);
    }
}
