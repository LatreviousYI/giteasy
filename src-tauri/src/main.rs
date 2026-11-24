#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod activity;
mod branch_ops;
mod error;
mod github;
mod model;
mod patch;
mod read;
mod rebase;
mod session;
mod settings;
mod shutdown;
mod ssh;
mod tools;
mod updater;
mod util;
mod watcher;
mod write;

use notify::RecommendedWatcher;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

pub struct AppState {
    pub settings: Mutex<settings::Settings>,
    pub watchers: Mutex<HashMap<String, RecommendedWatcher>>,
    pub sessions: session::RepoRegistry,
    pub github: github::GitHubService,
    pub shutting_down: AtomicBool,
}

fn main() {
    let loaded = settings::load();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            settings: Mutex::new(loaded),
            watchers: Mutex::new(HashMap::new()),
            sessions: session::RepoRegistry::default(),
            github: github::GitHubService::new(),
            shutting_down: AtomicBool::new(false),
        })
        .on_window_event(shutdown::on_window_event)
        .invoke_handler(tauri::generate_handler![
            shutdown::app_exit,
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
            read::commit_is_ancestor,
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
            branch_ops::merge_branch,
            branch_ops::rebase_branch,
            branch_ops::squash_merge_branch,
            write::tag_create,
            write::tag_delete,
            write::tag_push,
            write::remote_branch_delete,
            branch_ops::reset,
            branch_ops::cherry_pick,
            branch_ops::revert,
            rebase::rebase_todo,
            rebase::rebase_start,
            write::stash_save,
            write::stash_apply,
            write::stash_drop,
            write::remote_add,
            write::remote_update,
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
            updater::update_context,
            updater::open_update_page,
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

    fn commit_file(dir: &Path, file: &str, content: &str, message: &str) -> String {
        std::fs::write(dir.join(file), content).unwrap();
        git(dir, &["add", "--", file]);
        git(dir, &["commit", "-q", "-m", message]);
        git_output(dir, &["rev-parse", "HEAD"]).trim().to_string()
    }

    fn git_output(dir: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .current_dir(dir)
            .args(args)
            .env("GIT_AUTHOR_NAME", "Test User")
            .env("GIT_AUTHOR_EMAIL", "test@example.com")
            .env("GIT_COMMITTER_NAME", "Test User")
            .env("GIT_COMMITTER_EMAIL", "test@example.com")
            .output()
            .expect("run git");
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).to_string()
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
            read::diff_workdir_impl(path.clone(), "new.txt".to_string(), true, None, None).unwrap();
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
                reverse: None,
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

        let main_info = write::branch_checkout_impl(path.clone(), "main".to_string())
            .await
            .unwrap();
        assert_eq!(main_info.branch.as_deref(), Some("main"));
        let feature_info = write::branch_checkout_impl(path.clone(), "feature/test".to_string())
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

        let line_page = read::line_history(path.clone(), "hello.txt".to_string(), 1, 2, Some(20))
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
        std::fs::write(
            dir.join("hello.txt"),
            "line one\nline two\nline three\nline four\n",
        )
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
    fn pull_args_make_divergent_strategy_explicit() {
        let auto = write::pull_args(None, None, "auto").unwrap();
        assert!(auto.iter().any(|arg| arg == "--ff"));
        assert!(!auto.iter().any(|arg| arg == "--ff-only"));

        let merge = write::pull_args(Some("origin"), Some("main"), "merge").unwrap();
        assert!(merge.iter().any(|arg| arg == "--no-rebase"));
        assert!(merge.iter().any(|arg| arg == "--ff"));
        assert_eq!(merge.last().map(String::as_str), Some("main"));

        let rebase = write::pull_args(None, None, "rebase").unwrap();
        assert!(rebase.iter().any(|arg| arg == "--rebase"));

        let ff_only = write::pull_args(None, None, "ff-only").unwrap();
        assert!(ff_only.iter().any(|arg| arg == "--ff-only"));

        assert!(write::pull_args(None, None, "unknown").is_err());
    }

    #[test]
    fn stash_args_include_only_selected_paths() {
        let paths = vec!["src/app.ts".to_string(), "notes with space.txt".to_string()];
        let args = write::stash_args(Some("wip: selected files"), true, &paths);
        assert!(args.iter().any(|arg| arg == "-u"));
        assert!(args.iter().any(|arg| arg == "-m"));
        assert_eq!(
            args.last().map(String::as_str),
            Some("notes with space.txt")
        );
        assert_eq!(args.get(args.len() - 3).map(String::as_str), Some("--"));

        let all = write::stash_args(None, false, &[]);
        assert!(!all.iter().any(|arg| arg == "--"));
    }

    #[tokio::test]
    async fn partial_stash_leaves_unselected_changes_in_worktree() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::write(dir.join("hello.txt"), "line one\nline two changed\n").unwrap();
        std::fs::write(dir.join("new.txt"), "brand new\n").unwrap();

        write::stash_save_impl(
            &path,
            Some("partial stash"),
            false,
            &["hello.txt".to_string()],
        )
        .await
        .unwrap();

        assert_eq!(
            std::fs::read_to_string(dir.join("hello.txt")).unwrap(),
            "line one\nline two\n"
        );
        assert!(dir.join("new.txt").exists());
        let stashes = Command::new("git")
            .current_dir(&dir)
            .args(["stash", "list"])
            .output()
            .unwrap();
        assert_eq!(String::from_utf8_lossy(&stashes.stdout).lines().count(), 1);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn worktree_add_args_support_new_and_existing_branches() {
        let new_branch = write::worktree_add_args(
            "/tmp/worktree demo",
            Some("feature/worktree"),
            true,
            Some("HEAD"),
        );
        assert_eq!(
            new_branch,
            vec![
                "worktree",
                "add",
                "-b",
                "feature/worktree",
                "/tmp/worktree demo",
                "HEAD"
            ]
            .into_iter()
            .map(String::from)
            .collect::<Vec<_>>()
        );

        let existing = write::worktree_add_args(
            "/tmp/existing worktree",
            Some("feature/existing"),
            false,
            None,
        );
        assert_eq!(
            existing,
            vec![
                "worktree",
                "add",
                "/tmp/existing worktree",
                "feature/existing"
            ]
            .into_iter()
            .map(String::from)
            .collect::<Vec<_>>()
        );
    }

    #[tokio::test]
    async fn worktree_add_list_and_remove_round_trip_with_spaced_path() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let worktree = dir.join("worktree demo");
        let worktree_path = worktree.to_string_lossy().to_string();

        write::worktree_add_impl(
            &path,
            &worktree_path,
            Some("feature/worktree"),
            true,
            Some("HEAD"),
        )
        .await
        .unwrap();

        let listed = read::worktree_list(path.clone()).await.unwrap();
        let expected_path = std::fs::canonicalize(&worktree).unwrap();
        assert!(listed.iter().any(|item| {
            std::fs::canonicalize(&item.path)
                .map(|listed_path| listed_path == expected_path)
                .unwrap_or(false)
        }));
        assert!(listed
            .iter()
            .any(|item| item.branch.as_deref() == Some("feature/worktree")));

        write::worktree_remove_impl(&path, &worktree_path, true)
            .await
            .unwrap();
        assert!(!worktree.exists());

        let _ = std::fs::remove_dir_all(dir);
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
    async fn branch_delete_can_remove_local_and_remote_branch() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let bare = PathBuf::from(format!("{}-remote.git", dir.display()));
        let bare_arg = bare.to_string_lossy().to_string();

        git(&dir, &["init", "--bare", bare_arg.as_str()]);
        git(&dir, &["remote", "add", "origin", bare_arg.as_str()]);
        git(&dir, &["push", "-u", "origin", "main"]);
        git(&dir, &["branch", "feature/delete-me"]);
        git(&dir, &["push", "-u", "origin", "feature/delete-me"]);

        write::branch_delete_impl(
            path,
            "feature/delete-me".to_string(),
            true,
            Some("origin".to_string()),
            Some("feature/delete-me".to_string()),
        )
        .await
        .unwrap();

        let local_exists = Command::new("git")
            .current_dir(&dir)
            .args([
                "show-ref",
                "--verify",
                "--quiet",
                "refs/heads/feature/delete-me",
            ])
            .status()
            .unwrap()
            .success();
        let remote_exists = Command::new("git")
            .current_dir(&bare)
            .args([
                "show-ref",
                "--verify",
                "--quiet",
                "refs/heads/feature/delete-me",
            ])
            .status()
            .unwrap()
            .success();

        assert!(!local_exists);
        assert!(!remote_exists);
        let _ = std::fs::remove_dir_all(dir);
        let _ = std::fs::remove_dir_all(bare);
    }

    #[tokio::test]
    async fn branch_delete_reports_partial_remote_failure() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["branch", "feature/partial-delete"]);

        let error = write::branch_delete_impl(
            path,
            "feature/partial-delete".to_string(),
            true,
            Some("missing-remote".to_string()),
            Some("feature/partial-delete".to_string()),
        )
        .await
        .unwrap_err();

        assert!(error
            .message
            .contains("本地分支 feature/partial-delete 已删除"));
        assert!(error
            .message
            .contains("远程分支 missing-remote/feature/partial-delete"));
        assert!(error.hint.unwrap_or_default().contains("未删除"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn merge_and_rebase_use_selected_branch_as_source() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["switch", "-c", "feature/integration"]);
        commit_file(
            &dir,
            "feature.txt",
            "feature\n",
            "test: add feature integration",
        );
        git(&dir, &["switch", "main"]);
        commit_file(&dir, "main.txt", "main\n", "test: advance main");

        let info = branch_ops::merge_branch_impl(path.clone(), "feature/integration".into())
            .await
            .unwrap();
        assert_eq!(info.branch.as_deref(), Some("main"));
        let parents = git_output(&dir, &["rev-list", "--parents", "-n", "1", "HEAD"]);
        assert_eq!(parents.split_whitespace().count(), 3);

        git(&dir, &["switch", "feature/integration"]);
        commit_file(
            &dir,
            "feature-2.txt",
            "feature two\n",
            "test: feature follow-up",
        );
        branch_ops::rebase_branch_impl(path, "main".into())
            .await
            .unwrap();
        assert!(Command::new("git")
            .current_dir(&dir)
            .args(["merge-base", "--is-ancestor", "main", "feature/integration"])
            .status()
            .unwrap()
            .success());
        assert_eq!(
            git_output(&dir, &["rev-list", "--count", "main..feature/integration"]).trim(),
            "1"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn squash_merge_creates_one_commit() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let before = git_output(&dir, &["rev-list", "--count", "HEAD"])
            .trim()
            .parse::<usize>()
            .unwrap();
        git(&dir, &["switch", "-c", "feature/squash"]);
        commit_file(&dir, "one.txt", "one\n", "test: squash one");
        commit_file(&dir, "two.txt", "two\n", "test: squash two");
        git(&dir, &["switch", "main"]);

        let info = branch_ops::squash_merge_branch_impl(
            path,
            "feature/squash".into(),
            "test: squash merge feature".into(),
        )
        .await
        .unwrap();
        assert_eq!(info.branch.as_deref(), Some("main"));
        let after = git_output(&dir, &["rev-list", "--count", "HEAD"])
            .trim()
            .parse::<usize>()
            .unwrap();
        assert_eq!(after, before + 1);
        assert_eq!(
            git_output(&dir, &["log", "-1", "--format=%s"]).trim(),
            "test: squash merge feature"
        );
        assert_eq!(
            git_output(&dir, &["rev-list", "--parents", "-n", "1", "HEAD"])
                .split_whitespace()
                .count(),
            2
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn squash_merge_keeps_staged_changes_when_commit_fails() {
        use std::os::unix::fs::PermissionsExt;

        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["switch", "-c", "feature/squash-fail"]);
        commit_file(
            &dir,
            "squash.txt",
            "squash\n",
            "test: squash failure source",
        );
        git(&dir, &["switch", "main"]);

        let hook = dir.join(".git/hooks/pre-commit");
        std::fs::write(&hook, "#!/bin/sh\nexit 1\n").unwrap();
        let mut permissions = std::fs::metadata(&hook).unwrap().permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&hook, permissions).unwrap();

        let error = branch_ops::squash_merge_branch_impl(
            path.clone(),
            "feature/squash-fail".into(),
            "test: rejected squash".into(),
        )
        .await
        .err()
        .unwrap();
        assert!(error.message.contains("差异已暂存"));
        assert!(read::status_get_impl(path)
            .unwrap()
            .files
            .iter()
            .any(|file| file.staged));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn cherry_pick_multiple_commits_preserves_selected_order() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["switch", "-c", "feature/cherry"]);
        let first = commit_file(&dir, "first.txt", "first\n", "test: cherry first");
        let second = commit_file(&dir, "second.txt", "second\n", "test: cherry second");
        git(&dir, &["switch", "main"]);

        let info = branch_ops::cherry_pick_impl(path, vec![first, second])
            .await
            .unwrap();
        assert_eq!(info.branch.as_deref(), Some("main"));
        let subjects = git_output(&dir, &["log", "-2", "--format=%s"]);
        let subjects: Vec<&str> = subjects.lines().collect();
        assert_eq!(subjects, vec!["test: cherry second", "test: cherry first"]);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn cherry_pick_conflict_can_continue() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["switch", "-c", "feature/conflict"]);
        let feature = commit_file(
            &dir,
            "hello.txt",
            "line one\nfeature change\n",
            "test: conflicting feature",
        );
        git(&dir, &["switch", "main"]);
        commit_file(
            &dir,
            "hello.txt",
            "line one\nmain change\n",
            "test: conflicting main",
        );

        let error = branch_ops::cherry_pick_impl(path.clone(), vec![feature])
            .await
            .err()
            .unwrap();
        assert_eq!(error.kind, "conflict");
        std::fs::write(dir.join("hello.txt"), "line one\nresolved\n").unwrap();
        git(&dir, &["add", "hello.txt"]);
        write::op_continue_impl(&path, "cherry-pick").await.unwrap();
        assert!(read::status_get_impl(path).unwrap().clean);
        assert_eq!(
            std::fs::read_to_string(dir.join("hello.txt")).unwrap(),
            "line one\nresolved\n"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn cherry_pick_conflict_can_abort() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["switch", "-c", "feature/abort-conflict"]);
        let feature = commit_file(
            &dir,
            "hello.txt",
            "line one\nfeature abort\n",
            "test: aborting feature",
        );
        git(&dir, &["switch", "main"]);
        commit_file(
            &dir,
            "hello.txt",
            "line one\nmain abort\n",
            "test: aborting main",
        );
        let before = git_output(&dir, &["rev-parse", "HEAD"]).trim().to_string();

        let error = branch_ops::cherry_pick_impl(path.clone(), vec![feature])
            .await
            .err()
            .unwrap();
        assert_eq!(error.kind, "conflict");
        write::op_abort_impl(&path, "cherry-pick").await.unwrap();
        assert!(read::status_get_impl(path).unwrap().clean);
        assert_eq!(
            git_output(&dir, &["rev-parse", "HEAD"]).trim(),
            before.as_str()
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn revert_multiple_commits_and_reject_non_ancestor() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let first = commit_file(
            &dir,
            "hello.txt",
            "line one\nchanged once\n",
            "test: revert one",
        );
        let second = commit_file(
            &dir,
            "hello.txt",
            "line one\nchanged twice\n",
            "test: revert two",
        );

        git(&dir, &["switch", "-c", "feature/non-ancestor"]);
        let outside = commit_file(
            &dir,
            "outside.txt",
            "outside\n",
            "test: outside current branch",
        );
        git(&dir, &["switch", "main"]);

        let error = branch_ops::revert_impl(path.clone(), vec![outside])
            .await
            .err()
            .unwrap();
        assert!(error.message.contains("不在当前分支历史中"));

        branch_ops::revert_impl(path, vec![second, first])
            .await
            .unwrap();
        assert_eq!(
            std::fs::read_to_string(dir.join("hello.txt")).unwrap(),
            "line one\nline two\n"
        );
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn commit_list_validation_rejects_empty_merge_and_oversized_input() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        assert!(branch_ops::cherry_pick_impl(path.clone(), Vec::new())
            .await
            .is_err());
        assert!(
            branch_ops::cherry_pick_impl(path.clone(), vec!["not-an-oid".into()])
                .await
                .is_err()
        );
        let oversized: Vec<String> = (0..101).map(|index| format!("{index:040x}")).collect();
        let error = branch_ops::cherry_pick_impl(path.clone(), oversized)
            .await
            .err()
            .unwrap();
        assert!(error.message.contains("最多处理 100"));

        git(&dir, &["switch", "-c", "feature/merge-commit"]);
        commit_file(&dir, "feature.txt", "feature\n", "test: merge source");
        git(&dir, &["switch", "main"]);
        commit_file(&dir, "main.txt", "main\n", "test: main before merge");
        git(&dir, &["merge", "--no-edit", "feature/merge-commit"]);
        let merge_oid = git_output(&dir, &["rev-parse", "HEAD"]).trim().to_string();
        let error = branch_ops::cherry_pick_impl(path, vec![merge_oid])
            .await
            .err()
            .unwrap();
        assert!(error.message.contains("Merge 提交"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn reset_modes_preserve_or_discard_expected_changes() {
        for mode in ["soft", "mixed", "hard"] {
            let dir = fixture();
            let path = dir.to_string_lossy().to_string();
            let target = git_output(&dir, &["rev-parse", "HEAD"]).trim().to_string();
            commit_file(
                &dir,
                "hello.txt",
                "line one\ncommitted change\n",
                "test: reset base",
            );
            std::fs::write(dir.join("hello.txt"), "line one\nworktree\n").unwrap();
            std::fs::write(dir.join("staged.txt"), "staged\n").unwrap();
            git(&dir, &["add", "staged.txt"]);

            branch_ops::reset_impl(path.clone(), target, mode.into())
                .await
                .unwrap();
            let files = read::status_get_impl(path).unwrap().files;
            match mode {
                "soft" => {
                    assert!(files
                        .iter()
                        .any(|file| file.path == "staged.txt" && file.staged));
                    assert!(files
                        .iter()
                        .any(|file| file.path == "hello.txt" && file.unstaged));
                }
                "mixed" => {
                    assert!(files
                        .iter()
                        .any(|file| file.path == "staged.txt" && file.unstaged));
                    assert!(files
                        .iter()
                        .any(|file| file.path == "hello.txt" && file.unstaged));
                }
                "hard" => assert!(files.is_empty()),
                _ => unreachable!(),
            }
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    #[tokio::test]
    async fn tag_and_ancestor_helpers_use_selected_start_point() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        let initial = git_output(&dir, &["rev-parse", "HEAD"]).trim().to_string();
        git(&dir, &["switch", "-c", "feature/tag"]);
        let feature = commit_file(&dir, "tag.txt", "tag\n", "test: tag source");
        git(&dir, &["switch", "main"]);

        write::tag_create_impl(
            path.clone(),
            "v-test".into(),
            Some("annotated".into()),
            Some("feature/tag".into()),
        )
        .await
        .unwrap();
        let tagged = git_output(&dir, &["rev-list", "-n", "1", "v-test"])
            .trim()
            .to_string();
        assert_eq!(tagged, feature);
        assert!(read::commit_is_ancestor_inner(&path, &initial).unwrap());
        assert!(!read::commit_is_ancestor_inner(&path, &feature).unwrap());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn remote_crud_renames_and_updates_url() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();

        write::remote_add_impl(&path, "temp", "git@example.com:demo/old.git")
            .await
            .unwrap();
        write::remote_update_impl(&path, "temp", "renamed", "https://example.com/demo/new.git")
            .await
            .unwrap();

        let url = util::git_trimmed(&path, &["remote", "get-url", "renamed"])
            .await
            .unwrap();
        assert_eq!(url, "https://example.com/demo/new.git");

        write::remote_remove_impl(&path, "renamed").await.unwrap();
        let remotes = util::git(&path, &["remote"]).await.unwrap();
        assert!(remotes.trim().is_empty());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn remote_operations_reject_empty_values() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();

        assert!(
            write::remote_add_impl(&path, " ", "git@example.com:demo/repo.git")
                .await
                .is_err()
        );
        assert!(write::remote_add_impl(&path, "temp", " ").await.is_err());
        assert!(
            write::remote_update_impl(&path, "temp", "", "git@example.com:demo/repo.git")
                .await
                .is_err()
        );
        assert!(write::remote_update_impl(&path, "temp", "renamed", " ")
            .await
            .is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    #[ignore = "requires explicit real repository and disposable remote configuration"]
    async fn remote_update_manual_real_repo() {
        let path = std::env::var("GIT_EASY_REAL_REPO")
            .expect("GIT_EASY_REAL_REPO must point to a disposable real repository");
        let name = std::env::var("GIT_EASY_REAL_TEMP_REMOTE")
            .expect("GIT_EASY_REAL_TEMP_REMOTE must name a temporary remote");
        let renamed = std::env::var("GIT_EASY_REAL_TEMP_REMOTE_RENAMED").expect(
            "GIT_EASY_REAL_TEMP_REMOTE_RENAMED must name the temporary remote after update",
        );
        let url = std::env::var("GIT_EASY_REAL_TEMP_REMOTE_URL")
            .expect("GIT_EASY_REAL_TEMP_REMOTE_URL must contain the updated URL");

        write::remote_add_impl(&path, &name, "git@example.com:giteasy/old.git")
            .await
            .unwrap();
        write::remote_update_impl(&path, &name, &renamed, &url)
            .await
            .unwrap();
        assert_eq!(
            util::git_trimmed(&path, &["remote", "get-url", &renamed])
                .await
                .unwrap(),
            url
        );
        write::remote_remove_impl(&path, &renamed).await.unwrap();
    }

    #[tokio::test]
    #[ignore = "requires explicit real repository, remote and disposable nested branch"]
    async fn remote_branch_delete_manual_real_repo() {
        let path = std::env::var("GIT_EASY_REAL_REPO")
            .expect("GIT_EASY_REAL_REPO must point to a disposable real repository");
        let remote = std::env::var("GIT_EASY_REAL_REMOTE")
            .expect("GIT_EASY_REAL_REMOTE must name the real remote");
        let branch = std::env::var("GIT_EASY_REAL_BRANCH")
            .expect("GIT_EASY_REAL_BRANCH must name a disposable nested remote branch");

        write::remote_branch_delete_impl(&path, &remote, &branch)
            .await
            .unwrap();
    }

    #[tokio::test]
    #[ignore = "requires explicit real repository, remote and disposable branch"]
    async fn branch_delete_manual_real_remote() {
        let path = std::env::var("GIT_EASY_REAL_REPO")
            .expect("GIT_EASY_REAL_REPO must point to a disposable real repository");
        let remote = std::env::var("GIT_EASY_REAL_REMOTE")
            .expect("GIT_EASY_REAL_REMOTE must name the real remote");
        let branch = std::env::var("GIT_EASY_REAL_BRANCH")
            .expect("GIT_EASY_REAL_BRANCH must name a disposable remote branch");

        write::branch_delete_impl(path, branch.clone(), true, Some(remote), Some(branch))
            .await
            .unwrap();
    }

    #[tokio::test]
    async fn partial_staging_new_file_takes_selected_lines() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        std::fs::write(dir.join("new.txt"), "alpha\nbeta\ngamma\n").unwrap();

        let diff = read::diff_workdir_impl(path.clone(), "new.txt".to_string(), false, None, None)
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
        write::branch_create_impl(path.clone(), "feature/compare".to_string(), true, None)
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

        let branch_compare = read::compare_refs_impl(
            path.clone(),
            "main".to_string(),
            "feature/compare".to_string(),
        )
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

        let diff = read::image_diff_impl(
            path,
            "preview.svg".to_string(),
            "workdir".to_string(),
            None,
            None,
            None,
        )
        .unwrap();
        assert!(diff.before.is_none());
        assert!(diff
            .after
            .as_deref()
            .unwrap_or_default()
            .starts_with("data:image/svg+xml;base64,"));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn updater_install_kind_distinguishes_package_formats() {
        assert_eq!(
            updater::classify_install_kind("/tmp/GitEasy.AppImage", true, false),
            "appimage"
        );
        assert_eq!(
            updater::classify_install_kind(
                "/Applications/GitEasy.app/Contents/MacOS/giteasy",
                false,
                true
            ),
            "macos"
        );
        assert_eq!(
            updater::classify_install_kind("/usr/bin/giteasy", false, false),
            "deb"
        );
        assert_eq!(
            updater::classify_install_kind("/home/user/.local/opt/giteasy/giteasy", false, false),
            "portable"
        );
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
                reverse: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(page.commits.len(), 50);
        assert!(page.has_more);
        assert!(started.elapsed() < std::time::Duration::from_secs(10));

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn log_query_all_includes_unmerged_branch_tip() {
        let dir = fixture();
        let path = dir.to_string_lossy().to_string();
        git(&dir, &["switch", "-c", "feature/history-focus"]);
        std::fs::write(dir.join("hello.txt"), "feature branch change\n").unwrap();
        git(&dir, &["commit", "-q", "-am", "feature branch commit"]);
        git(&dir, &["switch", "main"]);

        let page = read::log_query(
            path,
            model::LogQuery {
                rev: Some("--all".to_string()),
                limit: 20,
                skip: 0,
                author: None,
                query: None,
                file: None,
                reverse: None,
            },
        )
        .await
        .unwrap();

        assert!(page
            .commits
            .iter()
            .any(|commit| commit.subject == "feature branch commit"));
        let _ = std::fs::remove_dir_all(dir);
    }
}
