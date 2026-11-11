#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;
mod error;
mod github;
mod model;
mod patch;
mod read;
mod rebase;
mod session;
mod settings;
mod ssh;
mod tools;
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
    pub github: github::GitHubService,
}

fn main() {
    let loaded = settings::load();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            settings: Mutex::new(loaded),
            watchers: Mutex::new(HashMap::new()),
            sessions: session::RepoRegistry::default(),
            github: github::GitHubService::new(),
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
            read::line_history,
            read::commit_detail,
            read::compare_refs,
            read::diff_range,
            read::commit_tree,
            read::file_at_rev,
            read::image_diff,
            read::reflog_list,
            read::branches_list,
            read::tags_list,
            read::remote_list,
            read::stash_list,
            read::stash_diff,
            read::blame_get,
            read::conflict_list,
            read::submodule_list,
            read::worktree_list,
            read::lfs_status,
            read::bisect_status,
            read::repo_stats,
            patch::apply_selection,
            patch::generate_patch,
            patch::save_patch_file,
            patch::read_patch_file,
            patch::apply_patch_text,
            patch::apply_patch_file,
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
            write::submodule_add,
            write::submodule_remove,
            write::submodule_move,
            write::worktree_add,
            write::worktree_remove,
            write::lfs_unlock,
            write::bisect_start,
            write::bisect_mark,
            write::bisect_skip,
            write::bisect_reset,
            write::open_in_editor,
            write::open_in_terminal,
            tools::run_custom_command,
            tools::run_external_tool,
            ssh::ssh_probe_remote,
            ssh::ssh_trust_remote,
            ssh::ssh_public_key,
            activity::activity_list,
            github::github_accounts,
            github::github_login_token,
            github::github_logout,
            github::github_device_start,
            github::github_device_poll,
            github::github_repos,
            github::github_notifications,
            github::github_pull_requests,
            github::github_issues,
            github::github_create_pull,
            github::github_clone,
            settings::settings_get,
            settings::settings_set,
            settings::repo_recent,
            settings::repo_forget,
            settings::repo_rename_recent,
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
            None,
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

        let main_info =
            write::branch_checkout_impl(path.clone(), "main".to_string()).await.unwrap();
        assert_eq!(main_info.branch.as_deref(), Some("main"));
        let feature_info = write::branch_checkout_impl(
            path.clone(),
            "feature/test".to_string(),
        )
        .await
        .unwrap();
        assert_eq!(feature_info.branch.as_deref(), Some("feature/test"));

        let tree = read::commit_tree_impl(path.clone(), "HEAD".to_string()).unwrap();
        assert!(tree.iter().any(|entry| entry.path == "hello.txt"));
        let content =
            read::file_at_rev_impl(path.clone(), "HEAD".to_string(), "hello.txt".to_string())
                .unwrap();
        assert!(!content.binary);
        assert!(content.content.unwrap().contains("line two changed"));

        let line_page = read::line_history(
            path.clone(),
            "hello.txt".to_string(),
            1,
            2,
            Some(20),
        )
        .await
        .unwrap();
        assert!(!line_page.commits.is_empty());
        assert!(line_page
            .commits
            .iter()
            .any(|commit| commit.subject == "test: commit changes"));

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

    #[test]
    fn remote_branch_checkout_preserves_nested_path() {
        let remotes = "origin\nupstream\n";
        assert_eq!(
            write::local_branch_name(remotes, "origin/feature/nested"),
            "feature/nested"
        );
        assert_eq!(
            write::local_branch_name(remotes, "upstream/release/2.0"),
            "release/2.0"
        );
        assert_eq!(
            write::local_branch_name("origin\n", "team/local-branch"),
            "team/local-branch"
        );
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

    #[tokio::test]
    async fn compare_refs_reports_branch_and_worktree_changes() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        write::branch_create_impl(
            path.clone(),
            "feature/compare".to_string(),
            true,
            None,
        )
        .await
        .unwrap();
        std::fs::write(dir.join("hello.txt"), "line one\nfeature line\n").unwrap();
        write::commit_create_impl(
            path.clone(),
            "feat: compare branch".to_string(),
            false,
            false,
            true,
            None,
        )
        .await
        .unwrap();
        write::branch_checkout_impl(path.clone(), "main".to_string())
            .await
            .unwrap();

        let branch_compare =
            read::compare_refs_impl(path.clone(), "main".to_string(), "feature/compare".to_string())
                .unwrap();
        assert_eq!(branch_compare.files.len(), 1);
        assert_eq!(branch_compare.files[0].path, "hello.txt");
        assert!(branch_compare.files[0].additions >= 1);
        assert!(branch_compare.files[0].deletions >= 1);

        std::fs::write(dir.join("hello.txt"), "line one\nworktree line\n").unwrap();
        let worktree_compare =
            read::compare_refs_impl(path, "main".to_string(), "WORKTREE".to_string()).unwrap();
        assert_eq!(worktree_compare.right_oid, "WORKTREE");
        assert_eq!(worktree_compare.files[0].path, "hello.txt");

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn patch_generation_and_application_round_trip() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::write(dir.join("hello.txt"), "line one\npatched line\n").unwrap();
        let patch_text = patch::generate_patch(
            path.clone(),
            "worktree".to_string(),
            None,
            None,
            Some("hello.txt".to_string()),
        )
        .await
        .unwrap();
        assert!(patch_text.contains("+patched line"));

        git(&dir, &["restore", "hello.txt"]);
        patch::apply_patch_text_impl(&path, &patch_text, true)
            .await
            .unwrap();
        patch::apply_patch_text_impl(&path, &patch_text, false)
            .await
            .unwrap();
        assert!(std::fs::read_to_string(dir.join("hello.txt"))
            .unwrap()
            .contains("patched line"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn image_diff_encodes_supported_images() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\" fill=\"#5b6cff\"/></svg>";
        std::fs::write(dir.join("preview.svg"), svg).unwrap();

        let diff =
            read::image_diff_impl(path, "preview.svg".to_string(), "workdir".to_string(), None, None, None)
                .unwrap();
        assert!(diff.before.is_none());
        assert!(diff
            .after
            .as_deref()
            .unwrap_or_default()
            .starts_with("data:image/svg+xml;base64,"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn log_pagination_handles_medium_history() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        for index in 0..80 {
            std::fs::write(dir.join("history.txt"), format!("revision {index}\n")).unwrap();
            git(&dir, &["add", "."]);
            git(
                &dir,
                &["commit", "-q", "-m", &format!("test: revision {index}")],
            );
        }
        let started = std::time::Instant::now();
        let page = read::log_query(
            path.clone(),
            model::LogQuery {
                rev: None,
                limit: 50,
                skip: 0,
                author: None,
                query: None,
                file: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(page.commits.len(), 50);
        assert!(page.has_more);
        assert!(started.elapsed() < std::time::Duration::from_secs(10));

        let _ = std::fs::remove_dir_all(dir);
    }
}
