# 分支整合、提交操作与远程分支菜单设计

日期：2026-11-24

状态：已确认，待实现

## 目标

补齐 GitEasy 的分支整合工作流：

- 本地和远程分支右键统一提供 Merge、Rebase、Squash、Cherry-pick、Reset 和创建标签。
- 远程分支右键补齐按 upstream 条件拉取和删除入口。
- 历史页支持多提交 Revert，并阻止回滚不在当前分支历史中的远程提交。
- 每个高风险或方向容易混淆的操作都在菜单和对话框中解释结果。

## 术语

- **当前分支**：当前检出的本地分支。分离头指针时不存在当前分支。
- **所选分支**：用户在侧边栏右键的本地或远程分支。
- **来源分支**：提交或差异来自的分支，即所选分支。
- **目标分支**：接收整合结果的分支，固定为当前分支。

所有整合操作只修改当前本地分支和本地工作区，不修改远程分支。

## 非目标

- 不实现 GitHub PR 的 Rebase and merge。
- 不支持 Cherry-pick 或 Revert Merge 提交，也不提供 mainline 选择。
- 不支持同一仓库并行执行多个写操作。
- 不修改远程分支内容。远程分支只会被拉取、用于创建标签或被删除。
- 不把当前分支移动到所选分支；Rebase 始终是把当前分支重放到所选分支之后。

## 分支菜单

`BranchContextMenu` 保持单层菜单，宽约 300px，按操作分组并允许内部滚动。菜单项使用两行信息：标题描述动作，说明文字解释结果和风险。

本地和远程分支共同提供：

| 菜单项 | 说明 | 行为 |
| --- | --- | --- |
| 合并到当前分支 | 保留双方历史，需要时创建合并提交 | `git merge --no-edit <所选分支>` |
| 变基当前分支到此分支 | 重放当前分支提交，会改写当前分支历史 | `git rebase <所选分支>` |
| Squash 合并到当前分支… | 将来源分支差异合成一个提交，可编辑提交信息 | `git merge --squash` 后提交 |
| Cherry-pick 提交… | 多选来源分支提交并应用到当前分支 | 按旧到新逐个应用 |
| 重置当前分支到此分支… | 移动当前分支指针，可选择保留或丢弃改动 | `git reset --soft|mixed|hard` |
| 创建标签… | 在所选分支最新提交上创建轻量或附注标签 | `git tag ... <startPoint>` |

本地分支继续提供现有检出、Push、设置上游、取消上游、重命名和删除操作。

远程分支额外提供：

| 菜单项 | 启用条件 | 说明 |
| --- | --- | --- |
| 创建本地分支… | 始终可用 | 默认去掉远程名前缀并允许改名 |
| 从该远程分支拉取当前分支 | 当前分支 upstream 等于该远程分支 | 复用现有 Pull 流程，不切换分支 |
| 删除远程分支… | 始终可用 | 使用现有确认框并执行 `git push <remote> --delete <branch>` |

远程分支的“拉取”不可用时显示具体原因；当前分支没有 upstream、upstream 指向其他分支或处于分离头指针时均禁用。

Revert 不放入分支菜单。历史页工具栏提供 `Revert 提交…`，提交选择器只针对当前分支已有提交。

## 条件与禁用规则

以下操作要求存在当前本地分支：

- Merge
- Rebase
- Squash
- Cherry-pick
- Reset
- Revert

仓库状态不是 `clean` 时，上述操作全部禁用，并提示先完成或中止当前 `merge`、`rebase`、`cherry-pick`、`revert` 等操作。

其他禁用条件：

- 对当前分支自身执行 Merge、Rebase、Squash 或 Reset 时禁用，避免无意义或自引用操作。
- 远程分支拉取仅在 `status.upstream === selectedRemoteBranch.name` 时启用。
- 分离头指针时不能执行任何依赖当前分支的整合操作。
- 历史页所选提交不是当前 `HEAD` 的祖先时禁用 Revert。

## 对话框

### SquashMergeDialog

显示：

- 来源分支
- 目标分支，即当前分支
- 可编辑的最终提交信息

默认提交信息为 `Squash merge <source> into <target>`。确认按钮为“Squash 并提交”。

执行顺序：

1. `git merge --squash <source>`
2. `git commit -m <message>`

如果第 1 步成功但第 2 步失败，错误详情必须说明差异已进入暂存区，用户可以修改提交信息或手动提交。

### ResetBranchDialog

显示当前分支、目标分支、目标 OID 和三种模式：

- `Soft`：移动分支指针，保留暂存区和工作区。
- `Mixed`：移动分支指针并清空暂存区，保留工作区。
- `Hard`：移动分支指针并丢弃暂存区与工作区改动。

默认选择 `Mixed`。`Hard` 使用危险样式和危险确认按钮。目标提交来自远程分支时，同时显示远程引用和短 OID。

### CommitSelectionDialog

同一组件支持两种模式：

- `cherry-pick`
- `revert`

共同行为：

- 支持选择一个或多个提交。
- 提交行显示短 OID、摘要、作者和时间。
- Merge 提交仍显示，但保持禁用并提示需要 mainline，当前版本不支持；后端也必须拒绝 Merge 提交。
- 单次最多提交 100 个 OID，自动去重。
- 没有选择时确认按钮禁用。

Cherry-pick 模式：

- 标题为“Cherry-pick 提交到当前分支”。
- 默认查询 `HEAD..<所选分支>`，并反转日志顺序。
- 按从旧到新显示和执行。
- 应用后每条来源提交生成一个当前分支上的新提交。

Revert 模式：

- 标题为“回滚当前分支提交”。
- 从当前分支历史选择，不继承历史页当前的搜索、作者或路径筛选。
- 按从新到旧显示和执行。
- 后端逐个确认所选 OID 是当前 `HEAD` 的祖先。

### TagDialog

现有 `TagDialog` 增加可选起点：

- 未提供起点时仍创建在当前 `HEAD`，保持现有行为。
- 从分支菜单打开时固定使用所选分支最新提交作为起点。
- 对话框显示标签起点。
- 填写说明时创建附注标签，否则创建轻量标签。

## 历史页 Revert

历史页工具栏增加 `Revert 提交…`。没有选中提交时仍可打开选择器，因为选择器使用当前分支历史。

提交详情中的单提交回滚继续保留，但根据 `commitIsAncestor` 结果控制可用性：

- 提交是当前 `HEAD` 祖先：允许 Revert。
- 远程提交不在当前分支历史中：禁用并提示改用 Cherry-pick。
- 分离头指针或仓库处于进行中的操作：禁用并提示原因。

## 数据流与 IPC

前端保持 Tauri 调用集中在 `src/lib/ipc.ts`。

IPC 接口：

- `mergeBranch(path, branch)`：保持现有名称，返回更新后的 `RepoInfo`。
- `rebaseBranch(path, onto)`：新增，返回更新后的 `RepoInfo`。
- `squashMergeBranch(path, source, message)`：新增，返回更新后的 `RepoInfo`。
- `cherryPick(path, oids)`：由单 OID 扩展为 OID 数组，返回更新后的 `RepoInfo`。
- `revert(path, oids)`：由单 OID 扩展为 OID 数组，返回更新后的 `RepoInfo`。
- `reset(path, oid, mode)`：保持模式参数，返回更新后的 `RepoInfo`。
- `tagCreate(path, name, message, startPoint)`：增加可选起点。
- `commitIsAncestor(path, oid)`：新增只读查询，返回布尔值。

`LogQuery` 增加可选参数：

- `reverse?: boolean`：向 Git 日志追加 `--reverse`。

该参数参与 TanStack Query 的查询 key；查询 key 通过完整 `LogQuery` 对象自然包含分支范围、过滤和排序参数。

## 前端组件

- `BranchContextMenu.tsx`：改为分组式两行菜单，接收当前分支状态、upstream 和操作进行中状态。
- `SquashMergeDialog.tsx`：来源、目标和提交信息确认。
- `ResetBranchDialog.tsx`：Reset 模式选择与危险确认。
- `CommitSelectionDialog.tsx`：Cherry-pick 和 Revert 共用提交多选界面。
- `TagDialog.tsx`：支持可选起点和来源标签。
- `HistoryView.tsx`：增加多提交 Revert 入口并接入祖先状态。
- `useBranchActions.ts`：保存新增分支操作的对话框状态、命令处理、toast 和统一 invalidation，避免继续扩大 `Sidebar.tsx`。

现有 `Modal`、`useModalFocus`、`ConfirmDialog` 和 `PromptDialog` 优先复用。新增对话框必须具备 `role="dialog"`、可访问标题、焦点锁定、Escape 关闭和关闭后焦点恢复。

## 后端结构

新的分支整合命令放入 `src-tauri/src/branch_ops.rs`，避免继续扩大 `write.rs`。本次迁移并扩展与功能直接相关的 Merge、Rebase、Squash、Reset、Cherry-pick 和 Revert 实现。

所有写命令：

- 通过 `session::acquire_repo_write` 获取仓库级写锁。
- 只通过共享 `util::git` 执行层运行 Git 命令。
- 使用 `AppError` 返回业务错误，不新增生产路径 `unwrap`/`expect`。

多提交校验：

- 拒绝空数组。
- 去重后最多 100 个 OID。
- 任一 OID 格式无效时拒绝整个请求。
- Merge 提交拒绝执行。
- Revert 逐个检查 OID 是否为当前 `HEAD` 祖先。

Cherry-pick 和 Revert 使用单次 Git 命令，保持已选顺序：

- `git cherry-pick --no-edit <oids...>`
- `git revert --no-edit <oids...>`

发生冲突时沿用现有冲突错误映射。冲突页的继续和中止继续调用 `op_continue` / `op_abort`，操作类型分别为 `cherry-pick` 和 `revert`。

## 执行结果与刷新

- 所有写操作成功后统一调用 `invalidateRepoQueries`。
- 改变 HEAD 的操作使用命令返回的 `RepoInfo` 更新当前仓库状态。
- 冲突后自动切换到冲突页。
- Reset、Merge、Rebase、Squash、Cherry-pick 和 Revert 的成功 toast 必须包含来源分支或目标短 OID。
- Pull 和 Delete 复用现有远程操作和确认流程。

## 测试

前端测试：

- 菜单分组、文案和说明在本地/远程分支上的完整渲染。
- 分离头指针、操作进行中、没有 upstream、upstream 不匹配时禁用操作并显示原因。
- 当前分支自身操作禁用。
- Squash 对话框显示来源/目标、默认提交信息并可编辑。
- Reset 对话框三种模式、默认 Mixed 和 Hard 危险状态。
- CommitSelectionDialog 单选、多选、排序、Merge 提交不可选和空选择禁用。
- 历史页 Revert 根据祖先条件和仓库状态启用或禁用。
- TagDialog 使用指定分支起点。
- 成功操作调用统一 repo invalidation。

Rust 临时仓库集成测试：

- Merge 创建合并提交，冲突映射和 continue 可继续。
- Rebase 将当前分支重放到所选分支之后，冲突映射和 continue 可继续。
- Squash 只生成一个提交，提交失败时差异保留在暂存区。
- 多个 Cherry-pick 按规定顺序生成多个新提交。
- 多个 Revert 按规定顺序生成多个反向提交。
- Revert 拒绝非当前 HEAD 祖先的提交。
- Cherry-pick 和 Revert 拒绝 Merge 提交、空数组、重复过多和非法 OID。
- Reset 的 soft、mixed、hard 分别保留或清理暂存区与工作区。
- 创建轻量标签和附注标签时使用指定起点。

## 交付顺序

第一阶段：

- 分组式平铺菜单和禁用条件。
- Merge、Rebase、Squash、Reset。
- 远程分支 Pull、Tag、Delete。

第二阶段：

- CommitSelectionDialog。
- 多提交 Cherry-pick 和 Revert。
- 历史页祖先检查和 Revert 入口。

每个阶段都必须独立通过前端测试、后端测试和构建，再进入下一阶段。

## 完成标准

- 本地和远程分支右键具备一致且可解释的整合操作。
- 远程分支只在 upstream 精确匹配时允许拉取当前分支。
- Squash 必须通过对话框确认提交信息。
- Revert 永远不会作用于不在当前分支历史中的提交。
- 所有新增命令具有成功、失败和冲突路径测试。
- `docs/CHANGELOG.md` 记录功能、交互和验证结果。
- `npm run test:all`、`git diff --check`、ESLint、Prettier、Clippy 和 rustfmt 全部通过。
