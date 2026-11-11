use crate::error::AppError;
use crate::model::Selection;
use crate::read::{build_diff, DiffSource};
use crate::util;
use git2::Patch;
use similar::TextDiff;
use tauri::State;

fn split_lines(text: &str) -> Vec<&str> {
    text.split_inclusive('\n').collect()
}

fn make_patch(file: &str, old: &str, new: &str) -> String {
    let diff = TextDiff::from_lines(old, new);
    let body = diff
        .unified_diff()
        .context_radius(3)
        .header(&format!("a/{file}"), &format!("b/{file}"))
        .to_string();
    format!("diff --git a/{file} b/{file}\n{body}")
}

fn make_new_file_patch(file: &str, new: &str) -> String {
    let diff = TextDiff::from_lines("", new);
    let body = diff
        .unified_diff()
        .context_radius(3)
        .header("/dev/null", &format!("b/{file}"))
        .to_string();
    format!("diff --git a/{file} b/{file}\nnew file mode 100644\n{body}")
}

fn compute_patch(
    path: &str,
    file: &str,
    mode: &str,
    selections: &[Selection],
) -> Result<Option<String>, AppError> {
    let repo = util::open_repo(path)?;
    let stage_mode = mode == "stage";
    let index_text = util::index_content(&repo, file);
    let source = if stage_mode {
        DiffSource::Workdir
    } else {
        DiffSource::Staged
    };
    let diff = build_diff(&repo, &source, false, 3)?;
    let mut delta_index = None;
    for (idx, delta) in diff.deltas().enumerate() {
        let new_path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        let old_path = delta
            .old_file()
            .path()
            .map(|p| p.to_string_lossy().to_string());
        if new_path.as_deref() == Some(file) || old_path.as_deref() == Some(file) {
            delta_index = Some(idx);
            break;
        }
    }
    let delta_index =
        delta_index.ok_or_else(|| AppError::not_found(format!("找不到文件差异：{file}")))?;
    let delta = diff.get_delta(delta_index).unwrap();
    let new_file = stage_mode
        && matches!(delta.status(), git2::Delta::Added | git2::Delta::Untracked);
    let deletion = matches!(delta.status(), git2::Delta::Deleted);
    if !matches!(delta.status(), git2::Delta::Modified) && !new_file && !deletion {
        return Err(AppError::user(
            "该文件类型暂不支持按块操作，请使用整文件操作",
        ));
    }
    let old_text = if new_file {
        index_text.unwrap_or_default()
    } else {
        index_text.ok_or_else(|| {
            AppError::user("该文件尚未被 Git 跟踪，暂不支持部分暂存，请先整体暂存")
        })?
    };
    let patch = Patch::from_diff(&diff, delta_index)?
        .ok_or_else(|| AppError::user("无法解析该文件的差异"))?;

    let result = if stage_mode {
        let old_lines = split_lines(&old_text);
        let mut result = String::new();
        let mut cursor = 0usize;
        for hi in 0..patch.num_hunks() {
            let (hunk, count) = patch.hunk(hi)?;
            let base = if hunk.old_lines() == 0 {
                hunk.old_start() as usize
            } else {
                (hunk.old_start() as usize).saturating_sub(1)
            };
            while cursor < base && cursor < old_lines.len() {
                result.push_str(old_lines[cursor]);
                cursor += 1;
            }
            let sel = selections.iter().find(|s| s.hunk == hi);
            for li in 0..count {
                let line = patch.line_in_hunk(hi, li)?;
                let picked = sel
                    .map(|s| s.lines.is_empty() || s.lines.contains(&li))
                    .unwrap_or(false);
                match line.origin() {
                    '+' => {
                        if picked {
                            result.push_str(&String::from_utf8_lossy(line.content()));
                        }
                    }
                    '-' => {
                        if let Some(text) = old_lines.get(cursor) {
                            if !picked {
                                result.push_str(text);
                            }
                        }
                        cursor += 1;
                    }
                    _ => {
                        if let Some(text) = old_lines.get(cursor) {
                            result.push_str(text);
                        }
                        cursor += 1;
                    }
                }
            }
        }
        while cursor < old_lines.len() {
            result.push_str(old_lines[cursor]);
            cursor += 1;
        }
        result
    } else {
        let index_lines = split_lines(&old_text);
        let mut result = String::new();
        let mut cursor = 0usize;
        for hi in 0..patch.num_hunks() {
            let (hunk, count) = patch.hunk(hi)?;
            let base = if hunk.new_lines() == 0 {
                hunk.new_start() as usize
            } else {
                (hunk.new_start() as usize).saturating_sub(1)
            };
            while cursor < base && cursor < index_lines.len() {
                result.push_str(index_lines[cursor]);
                cursor += 1;
            }
            let sel = selections.iter().find(|s| s.hunk == hi);
            for li in 0..count {
                let line = patch.line_in_hunk(hi, li)?;
                let picked = sel
                    .map(|s| s.lines.is_empty() || s.lines.contains(&li))
                    .unwrap_or(false);
                match line.origin() {
                    '+' => {
                        if !picked {
                            if let Some(text) = index_lines.get(cursor) {
                                result.push_str(text);
                            }
                        }
                        cursor += 1;
                    }
                    '-' => {
                        if picked {
                            result.push_str(&String::from_utf8_lossy(line.content()));
                        }
                    }
                    _ => {
                        if let Some(text) = index_lines.get(cursor) {
                            result.push_str(text);
                        }
                        cursor += 1;
                    }
                }
            }
        }
        while cursor < index_lines.len() {
            result.push_str(index_lines[cursor]);
            cursor += 1;
        }
        result
    };

    if result == old_text {
        return Ok(None);
    }
    let patch_text = if new_file {
        make_new_file_patch(file, &result)
    } else {
        make_patch(file, &old_text, &result)
    };
    Ok(Some(patch_text))
}

pub async fn apply_selection_impl(
    path: &str,
    file: &str,
    mode: &str,
    selections: Vec<Selection>,
) -> Result<(), AppError> {
    let patch_path = path.to_string();
    let patch_file = file.to_string();
    let patch_mode = mode.to_string();
    let patch_text = tauri::async_runtime::spawn_blocking(move || {
        compute_patch(
            &patch_path,
            &patch_file,
            &patch_mode,
            &selections,
        )
    })
    .await
    .map_err(|error| {
        AppError::new("runtime", "E_BLOCKING_PATCH", "后台解析补丁失败")
            .with_detail(error.to_string())
    })??;
    if let Some(patch_text) = patch_text {
        util::git_output(
            path,
            &["apply", "--cached", "--whitespace=nowarn", "-"],
            Some(patch_text.as_bytes()),
        )
        .await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn apply_selection(
    state: State<'_, crate::AppState>,
    path: String,
    file: String,
    mode: String,
    selections: Vec<Selection>,
) -> Result<(), AppError> {
    let _guard = crate::session::acquire_repo_write(&state, &path).await;
    apply_selection_impl(&path, &file, &mode, selections).await
}
