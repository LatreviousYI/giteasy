#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;
mod error;
mod model;
mod patch;
mod read;
mod rebase;
mod session;
mod settings;
mod ssh;
mod util;
mod watcher;
mod write;

use notify::RecommendedWatcher;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct AppState {
    pub settings: Mutex<settings::Settings>,
    pub watchers: Mutex<HashMap<String, RecommendedWatcher>>,
    pub sessions: session::RepoRegistry,
}

fn main() {
    let loaded = settings::load();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            settings: Mutex::new(loaded),
            watchers: Mutex::new(HashMap::new()),
            sessions: session::RepoRegistry::default(),
        })
        .invoke_handler(tauri::generate_handler![
            read::repo_open,
            read::repo_close,
            read::repo_init,
            read::repo_discover,
            read::status_get,
            read::diff_workdir,
            read::diff_commit,
            read::log_query,
            read::file_history,
            read::commit_detail,
            read::branches_list,
            read::tags_list,
            read::remote_list,
            read::stash_list,
            read::stash_diff,
            read::blame_get,
            read::conflict_list,
            read::submodule_list,
            read::worktree_list,
            patch::apply_selection,
            write::stage_paths,
            write::discard_paths,
            write::commit_create,
            write::branch_create,
            write::branch_checkout,
            write::commit_checkout,
            write::branch_delete,
            write::branch_rename,
            write::branch_set_upstream,
            write::merge_branch,
            write::tag_create,
            write::tag_delete,
            write::tag_push,
            write::remote_branch_delete,
            write::reset,
            write::cherry_pick,
            write::revert,
            rebase::rebase_todo,
            rebase::rebase_start,
            write::stash_save,
            write::stash_apply,
            write::stash_drop,
            write::remote_add,
            write::remote_remove,
            write::fetch,
            write::pull,
            write::push,
            write::op_abort,
            write::op_continue,
            write::conflict_resolve,
            write::submodule_update,
            write::worktree_add,
            write::worktree_remove,
            write::open_in_editor,
            write::open_in_terminal,
            ssh::ssh_probe_remote,
            ssh::ssh_trust_remote,
            ssh::ssh_public_key,
            activity::activity_list,
            settings::settings_get,
            settings::settings_set,
            settings::repo_recent,
            settings::repo_forget,
            settings::identity_get,
            settings::identity_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running GitEasy");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::process::Command;

    fn git(dir: &Path, args: &[&str]) {
        let status = Command::new("git")
            .current_dir(dir)
            .args(args)
            .env("GIT_AUTHOR_NAME", "Test User")
            .env("GIT_AUTHOR_EMAIL", "test@example.com")
            .env("GIT_COMMITTER_NAME", "Test User")
            .env("GIT_COMMITTER_EMAIL", "test@example.com")
            .status()
            .expect("run git");
        assert!(status.success(), "git {:?} failed", args);
    }

    fn fixture() -> PathBuf {
        let base = std::env::temp_dir().join(format!(
            "giteasy-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&base).unwrap();
        git(&base, &["init", "-q", "-b", "main"]);
        git(&base, &["config", "user.name", "Test User"]);
        git(&base, &["config", "user.email", "test@example.com"]);
        std::fs::write(base.join("hello.txt"), "line one\nline two\n").unwrap();
        git(&base, &["add", "."]);
        git(&base, &["commit", "-q", "-m", "initial commit"]);
        base
    }

    #[tokio::test]
    async fn repo_flow_status_stage_commit_and_log() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();

        let info = read::repo_info_inner(&path).unwrap();
        assert_eq!(info.branch.as_deref(), Some("main"));

        let status = read::status_get_impl(path.clone()).unwrap();
        assert!(status.clean);
        assert!(status.files.is_empty());

        std::fs::write(dir.join("hello.txt"), "line one\nline two changed\n").unwrap();
        std::fs::write(dir.join("new.txt"), "brand new\n").unwrap();

        let status = read::status_get_impl(path.clone()).unwrap();
        assert_eq!(status.files.len(), 2);
        let hello = status
            .files
            .iter()
            .find(|file| file.path == "hello.txt")
            .unwrap();
        assert_eq!(hello.worktree, "modified");
        let new_file = status
            .files
            .iter()
            .find(|file| file.path == "new.txt")
            .unwrap();
        assert_eq!(new_file.worktree, "untracked");

        let diff =
            read::diff_workdir_impl(path.clone(), "hello.txt".to_string(), false, None, None)
                .unwrap();
        assert!(!diff.hunks.is_empty());
        assert!(diff.additions >= 1);

        let untracked_diff =
            read::diff_workdir_impl(path.clone(), "new.txt".to_string(), false, None, None)
                .unwrap();
        assert!(!untracked_diff.hunks.is_empty());
        assert_eq!(untracked_diff.status, "added");

        write::stage_paths_impl(
            path.clone(),
            vec!["hello.txt".to_string(), "new.txt".to_string()],
            true,
        )
        .await
        .unwrap();

        let staged = read::status_get_impl(path.clone()).unwrap();
        assert!(staged.files.iter().all(|file| file.staged));

        let staged_diff =
            read::diff_workdir_impl(path.clone(), "new.txt".to_string(), true, None, None)
                .unwrap();
        assert!(!staged_diff.hunks.is_empty());

        let result = write::commit_create_impl(
            path.clone(),
            "test: commit changes".to_string(),
            false,
            false,
            false,
        )
        .await
        .unwrap();
        let oid = result.oid;
        assert_eq!(oid.len(), 40);

        let page = read::log_query(
            path.clone(),
            model::LogQuery {
                rev: None,
                limit: 10,
                skip: 0,
                author: None,
                query: None,
                file: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(page.commits.len(), 2);
        assert_eq!(page.commits[0].subject, "test: commit changes");
        assert_eq!(page.commits[0].parents.len(), 1);

        write::branch_create_impl(path.clone(), "feature/test".to_string(), true, None)
            .await
            .unwrap();
        let after_branch = read::status_get_impl(path.clone()).unwrap();
        assert_eq!(after_branch.branch.as_deref(), Some("feature/test"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn rebase_todo_lists_commits_after_base() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::write(dir.join("hello.txt"), "line one\nline two\nline three\n").unwrap();
        git(&dir, &["commit", "-q", "-am", "second commit"]);
        std::fs::write(dir.join("hello.txt"), "line one\nline two\nline three\nline four\n")
            .unwrap();
        git(&dir, &["commit", "-q", "-am", "third commit"]);

        let base = std::process::Command::new("git")
            .current_dir(&dir)
            .args(["rev-parse", "HEAD~2"])
            .output()
            .unwrap();
        let base = String::from_utf8_lossy(&base.stdout).trim().to_string();

        let commits = rebase::rebase_todo(path.clone(), base).await.unwrap();
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].subject, "second commit");
        assert_eq!(commits[1].subject, "third commit");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn push_args_sets_upstream_for_new_remote() {
        let args = write::push_args(Some("origin"), Some("main"), None, false, true);
        assert_eq!(
            args,
            vec!["push", "--progress", "-u", "origin", "main"]
                .into_iter()
                .map(String::from)
                .collect::<Vec<_>>()
        );

        let mapped = write::push_args(Some("origin"), Some("main"), Some("release"), false, true);
        assert!(mapped.iter().any(|arg| arg == "main:release"));

        let force_args = write::push_args(Some("origin"), Some("main"), None, true, false);
        assert!(force_args.iter().any(|arg| arg == "--force-with-lease"));
        assert!(!force_args.iter().any(|arg| arg == "-u"));
    }

    #[tokio::test]
    async fn partial_staging_new_file_takes_selected_lines() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::write(dir.join("new.txt"), "alpha\nbeta\ngamma\n").unwrap();

        let diff =
            read::diff_workdir_impl(path.clone(), "new.txt".to_string(), false, None, None)
                .unwrap();
        assert_eq!(diff.status, "added");
        assert_eq!(diff.hunks.len(), 1);

        patch::apply_selection_impl(
            &path,
            "new.txt",
            "stage",
            vec![model::Selection {
                hunk: 0,
                lines: vec![0, 2],
            }],
        )
        .await
        .unwrap();

        let staged = Command::new("git")
            .current_dir(&dir)
            .args(["show", ":new.txt"])
            .output()
            .unwrap();
        assert_eq!(String::from_utf8_lossy(&staged.stdout), "alpha\ngamma\n");
        assert_eq!(
            std::fs::read_to_string(dir.join("new.txt")).unwrap(),
            "alpha\nbeta\ngamma\n"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn partial_hunk_staging_applies_selected_change_only() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::write(
            dir.join("hello.txt"),
            "line one\nline two changed\nline three\n",
        )
        .unwrap();

        let diff =
            read::diff_workdir_impl(path.clone(), "hello.txt".to_string(), false, None, None)
                .unwrap();
        assert_eq!(diff.hunks.len(), 1);

        patch::apply_selection_impl(
            &path,
            "hello.txt",
            "stage",
            vec![model::Selection {
                hunk: 0,
                lines: vec![],
            }],
        )
        .await
        .unwrap();

        let staged = read::status_get_impl(path.clone()).unwrap();
        let file = staged
            .files
            .iter()
            .find(|item| item.path == "hello.txt")
            .unwrap();
        assert!(file.staged);
        assert!(!file.unstaged);

        let committed = Command::new("git")
            .current_dir(&dir)
            .args(["show", ":hello.txt"])
            .output()
            .unwrap();
        assert_eq!(
            String::from_utf8_lossy(&committed.stdout),
            "line one\nline two changed\nline three\n"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn partial_deletion_staging_keeps_unselected_lines() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::remove_file(dir.join("hello.txt")).unwrap();

        let diff =
            read::diff_workdir_impl(path.clone(), "hello.txt".to_string(), false, None, None)
                .unwrap();
        assert_eq!(diff.status, "deleted");
        assert_eq!(diff.hunks.len(), 1);

        patch::apply_selection_impl(
            &path,
            "hello.txt",
            "stage",
            vec![model::Selection {
                hunk: 0,
                lines: vec![0],
            }],
        )
        .await
        .unwrap();

        let staged = Command::new("git")
            .current_dir(&dir)
            .args(["show", ":hello.txt"])
            .output()
            .unwrap();
        assert_eq!(String::from_utf8_lossy(&staged.stdout), "line two\n");
        assert!(!dir.join("hello.txt").exists());

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn partial_hunk_staging_isolates_multiple_hunks() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let original = (1..=24)
            .map(|line| format!("line {line}\n"))
            .collect::<String>();
        std::fs::write(dir.join("hello.txt"), &original).unwrap();
        git(&dir, &["add", "."]);
        git(&dir, &["commit", "-q", "-m", "expand fixture"]);

        let changed = original
            .replace("line 2\n", "line 2 changed\n")
            .replace("line 22\n", "line 22 changed\n");
        std::fs::write(dir.join("hello.txt"), &changed).unwrap();

        let diff =
            read::diff_workdir_impl(path.clone(), "hello.txt".to_string(), false, None, None)
                .unwrap();
        assert!(diff.hunks.len() >= 2);

        patch::apply_selection_impl(
            &path,
            "hello.txt",
            "stage",
            vec![model::Selection {
                hunk: 0,
                lines: vec![],
            }],
        )
        .await
        .unwrap();

        let staged = Command::new("git")
            .current_dir(&dir)
            .args(["show", ":hello.txt"])
            .output()
            .unwrap();
        let staged = String::from_utf8_lossy(&staged.stdout);
        assert!(staged.contains("line 2 changed"));
        assert!(staged.contains("line 22\n"));
        assert!(!staged.contains("line 22 changed"));
        assert!(std::fs::read_to_string(dir.join("hello.txt"))
            .unwrap()
            .contains("line 22 changed"));

        let _ = std::fs::remove_dir_all(dir);
    }
}
