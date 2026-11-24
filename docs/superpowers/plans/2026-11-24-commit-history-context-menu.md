# 提交历史右键菜单实施计划

- 状态：已完成
- 日期：2026-11-24
- 设计：[2026-11-24-commit-history-context-menu-design.md](../specs/2026-11-24-commit-history-context-menu-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，最终运行完整质量门禁。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 共享菜单基础

- [x] 新增 `ContextMenuSurface`、`ContextMenuItem` 和 `ContextMenuDivider`。
- [x] 新增 `clampContextMenuPosition` 纯函数。
- [x] 补视口夹取边界测试。
- [x] 将 `BranchContextMenu` 迁移到共享基础组件。
- [x] 保持现有分支菜单测试全部通过。

## TASK-02 提交右键菜单

- [x] 新增 `CommitContextMenu` 和菜单状态类型。
- [x] 实现 Cherry-pick、Revert、Reset、交互式变基、创建并检出分支、创建标签、检出和复制哈希。
- [x] 覆盖分离头指针、操作进行中、Merge 提交、祖先加载中和非祖先 Revert 禁用状态。
- [x] 补菜单文案、动作回调和禁用原因测试。

## TASK-03 历史页命令编排

- [x] 新增 `useHistoryCommitActions`，管理菜单、对话框、祖先查询和命令。
- [x] 右键提交行先选中再打开菜单。
- [x] 支持 `Shift+F10` 和 Context Menu 键打开当前提交菜单。
- [x] Cherry-pick/Revert 成功后更新 `RepoInfo` 并 invalidation。
- [x] 冲突后关闭菜单并切换到冲突页。
- [x] 创建分支和标签失败时保留对话框，成功后关闭。

## TASK-04 集成与测试

- [x] `HistoryView` 接入提交菜单和 dialogs。
- [x] 创建分支使用默认名称和提交 OID 起点。
- [x] 创建标签使用提交 OID 起点。
- [x] Reset 使用提交短 OID 和完整 OID。
- [x] 补历史行右键、键盘打开、分支/标签起点和 Reset 目标测试。
- [x] 更新 E2E，验证菜单内容和 Merge 提交限制。

## TASK-05 文档与验证

- [x] 更新 `docs/CHANGELOG.md`。
- [x] `npm run test:all`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [x] `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- [x] `git diff --check`
- [x] E2E 后恢复非目标视觉基线文件。
