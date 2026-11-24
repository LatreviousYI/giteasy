# 分支整合与提交操作实施计划

- 状态：已完成
- 日期：2026-11-24
- 设计：[2026-11-24-branch-integration-actions-design.md](../specs/2026-11-24-branch-integration-actions-design.md)
- 记录规则：每完成一项更新本清单和 `docs/CHANGELOG.md`，每个阶段分别运行相关测试。

## 状态说明

- `[ ]` 未开始
- `[-]` 进行中
- `[x]` 已完成
- `[!]` 阻塞

## TASK-01 后端分支操作模块

- [x] 新建 `src-tauri/src/branch_ops.rs`，迁移 Merge、Reset、Cherry-pick 和 Revert 实现。
- [x] 保留 `merge_branch` command 名称，改为调用可测试的 `merge_branch_impl`。
- [x] 新增 `rebase_branch` command 和 `rebase_branch_impl`。
- [x] 新增 `squash_merge_branch` command 和 `squash_merge_branch_impl`。
- [x] 扩展 `reset`、`cherry_pick` 和 `revert`，成功后返回 `RepoInfo`。
- [x] 扩展 `cherry_pick` 和 `revert` 接收 OID 数组，校验空数组、数量、格式、重复项和 Merge 提交。
- [x] Revert 执行前逐个确认 OID 是当前 `HEAD` 祖先。
- [x] Squash 分开处理 `merge --squash` 与 `commit` 错误，提交失败时说明差异已暂存。
- [x] 所有写命令使用仓库写锁和共享 `util::git` 执行层。
- [x] 在 `main.rs` 注册新增 command，并更新 import。

## TASK-02 标签、祖先检查与日志排序

- [x] 扩展 `tag_create` 接收可选 `start_point`，轻量标签和附注标签都使用该起点。
- [x] 新增只读 `commit_is_ancestor(path, oid)`，通过现有 blocking read 封装执行。
- [x] 为 `LogQuery` 增加可选 `reverse` 参数。
- [x] `log_query` 在 `reverse` 为 true 时追加 `--reverse`。
- [x] 验证查询 key 包含新增参数。

## TASK-03 后端集成测试

- [x] 临时真实仓库测试 Merge 生成合并提交。
- [x] 测试 Rebase 只重放当前分支，并验证结果拓扑。
- [x] 测试 Squash 只生成一个提交。
- [x] 模拟提交失败，验证暂存区差异保留和错误提示。
- [x] 测试多个 Cherry-pick 按规定顺序生成多个提交。
- [x] 测试多个 Revert 按规定顺序生成多个反向提交。
- [x] 测试 Revert 拒绝非当前 `HEAD` 祖先。
- [x] 测试 Cherry-pick/Revert 拒绝 Merge 提交、空数组、重复项、非法 OID 和超过 100 个 OID。
- [x] 测试 Reset 的 soft、mixed、hard 对暂存区和工作区的影响。
- [x] 测试轻量标签和附注标签使用指定分支起点。
- [x] 测试 `commit_is_ancestor` 的祖先、非祖先和无效 OID 路径。
- [x] 测试 conflict 错误映射；验证 `op_continue` 和 `op_abort` 覆盖 cherry-pick/revert。

## TASK-04 IPC、类型和 Mock

- [x] 更新 `src/lib/ipc.ts` 中 Merge、Rebase、Squash、Cherry-pick、Revert、Reset、Tag 和祖先检查接口。
- [x] 更新 `src/lib/types.ts` 的 `LogQuery.reverse`。
- [x] 更新 `src/lib/mock.ts`，为新增命令和返回 `RepoInfo` 的行为提供可运行预览数据。
- [x] 复查所有调用方，移除单 OID Cherry-pick/Revert 的旧假设。

## TASK-05 分组式分支菜单

- [x] 将 `BranchContextMenu` 改为约 300px 宽的分组式两行菜单。
- [x] 增加 Merge、Rebase、Squash、Cherry-pick、Reset 和标签操作。
- [x] 远程分支增加条件 Pull 和删除入口，并保留创建本地分支。
- [x] 传入当前分支、upstream、detached 和仓库 state，集中计算禁用原因。
- [x] 当前分支自身、操作进行中、无 upstream、upstream 不匹配以及 detached 时禁用并显示原因。
- [x] 调整菜单定位高度，内容超过视口时允许内部滚动。
- [x] 更新 `BranchContextMenu.test.tsx`，覆盖文案、顺序和全部禁用状态。

## TASK-06 Squash 与 Reset 对话框

- [x] 新增 `SquashMergeDialog.tsx`，显示来源/目标并允许编辑提交信息。
- [x] 默认提交信息使用 `Squash merge <source> into <target>`。
- [x] 新增 `ResetBranchDialog.tsx`，默认 Mixed，Hard 使用危险样式。
- [x] 两个对话框复用 `Modal` 和 `useModalFocus`，补齐可访问标题和关闭后焦点恢复。
- [x] 补组件测试，覆盖默认值、模式切换、取消、忙碌和提交。

## TASK-07 分支操作编排

- [x] 新增 `useBranchActions.ts`，集中保存分支操作对话框状态和命令处理函数。
- [x] `Sidebar.tsx` 只负责打开菜单和传入仓库上下文，不在组件中继续堆积命令编排。
- [x] Merge、Rebase、Squash、Reset、Cherry-pick 和 Revert 成功后使用返回的 `RepoInfo` 更新当前仓库。
- [x] Tag 成功后只刷新标签和通用仓库查询，不伪造 `RepoInfo` 返回值。
- [x] 所有成功动作统一调用 `invalidateRepoQueries`。
- [x] 冲突错误切换到冲突页，并保留现有继续/中止流程。
- [x] 远程分支 Pull 复用现有 Pull 分流，且不自动切换分支。
- [x] 远程删除复用现有确认框和 `remoteBranchDelete`。

## TASK-08 提交多选器与 Cherry-pick

- [x] 新增 `CommitSelectionDialog.tsx`，支持单模式配置和最多 100 个选择。
- [x] Cherry-pick 查询 `HEAD..<所选分支>`，使用 `reverse` 按旧到新显示。
- [x] Merge 提交显示但禁用，并说明当前版本不支持 mainline。
- [x] 按选择顺序提交 OID 数组，成功后刷新仓库。
- [x] 冲突时进入冲突页，并验证继续/中止使用 `cherry-pick`。
- [x] 补多选、排序、禁用项、空选择和超过数量限制的组件测试。

## TASK-09 多提交 Revert 与历史页入口

- [x] 历史页工具栏增加 `Revert 提交…`，选择器使用当前分支历史，不继承搜索筛选。
- [x] Revert 提交按新到旧显示并执行。
- [x] 提交详情单提交 Revert 改为调用 OID 数组接口。
- [x] 使用 `commit_is_ancestor` 控制历史页 Revert；远程非祖先提交禁用并提示改用 Cherry-pick。
- [x] detached 或仓库 state 非 clean 时禁用 Revert 并显示原因。
- [x] 补组件测试，覆盖祖先、非祖先、detached 和进行中状态。

## TASK-10 文档与阶段验证

- [x] 第一阶段完成后更新 `docs/CHANGELOG.md`，记录菜单、Merge、Rebase、Squash、Reset、Pull、Tag、Delete。
- [x] 第二阶段完成后追加 Cherry-pick、Revert、多选器和祖先检查记录。
- [x] 每个阶段运行相关 Vitest 和 Rust 集成测试。
- [x] 每个阶段运行 `npm run build`，确保 IPC 和类型契约一致。

## 最终验证

- [x] `npm run test:all`
- [x] `npm run lint`
- [x] `npm run format:check`
- [x] `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
- [x] `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`
- [x] `git diff --check`
- [x] 检查 E2E 是否改写 `docs/visual-baselines/`；非有意更新时恢复生成文件。
- [x] E2E 验证远程菜单、upstream Pull 条件和页面无溢出。
