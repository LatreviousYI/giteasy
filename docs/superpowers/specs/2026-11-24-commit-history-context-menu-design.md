# 提交历史右键菜单设计

日期：2026-11-24

状态：已确认，待实现

## 目标

- 在提交历史行上提供与分支菜单一致的分组式两行右键菜单。
- 将 Cherry-pick、Revert、Reset 和交互式变基直接放到提交行入口。
- 支持从指定提交创建或检出分支、创建标签、检出提交和复制哈希。
- 复用已经完成的祖先检查、冲突处理、对话框和查询刷新逻辑。

## 非目标

- 不在提交菜单中提供 Merge、Squash 或“变基当前分支到提交”。
- 不支持 Merge 提交的 Cherry-pick 或 Revert。
- 不新增后端 Git command；现有分支和提交命令已经覆盖本次操作。
- 不改变提交详情工具栏现有操作。

## 菜单入口

提交历史中的普通提交行支持：

- 鼠标右键：先选中该提交，再以指针位置打开菜单。
- `Shift+F10` 或键盘 Context Menu 键：选中当前提交，并以该行位置打开菜单。
- Stash 行继续使用现有预览行为，不打开提交菜单。

菜单位置使用共享的视口夹取逻辑。菜单宽约 300px，高度超过可用视口时调整到上方并允许内部滚动。

## 菜单内容

菜单标题显示提交短 OID 和摘要，例如：

```text
a1b2c3d · feat: 添加仓库筛选
```

分组内容：

| 菜单项 | 说明 | 执行结果 |
| --- | --- | --- |
| Cherry-pick 到当前分支 | 保留原提交信息，在当前分支创建新提交 | `cherry_pick([oid])` |
| 回滚此提交 | 创建反向提交，不重写历史 | `revert([oid])` |
| 重置当前分支到此提交… | 可选择保留或丢弃暂存区、工作区改动 | 打开 `ResetBranchDialog` |
| 从此提交后交互式变基… | 编辑该提交之后的本地提交 | 打开现有 `RebaseDialog` |
| 创建并检出分支… | 以该提交为起点创建并切换分支 | `branchCreate(checkout=true, startPoint=oid)` |
| 在此外创建标签… | 标签起点固定为该提交 | 打开 `TagDialog(startPoint=oid)` |
| 检出此提交 | 进入分离头指针 | `commitCheckout` |
| 复制完整哈希 | 复制未缩写 OID | `copyTextWithToast` |

菜单项必须包含说明文字，不能只显示动作名称。

## 禁用规则

Cherry-pick、Revert 和 Reset 依赖当前本地分支。以下情况显示菜单项但禁用并解释原因：

- 分离头指针：提示先检出本地分支。
- 仓库正在 Merge、Rebase、Cherry-pick 或 Revert：提示先完成或中止当前操作。
- 提交是 Merge 提交：Cherry-pick 和 Revert 禁用，提示暂不支持 mainline。
- Revert 的提交不在当前 `HEAD` 历史中：禁用并提示改用 Cherry-pick。

Reset 允许 Merge 提交作为目标，因为它只移动当前分支指针。

创建并检出分支、创建标签、检出提交和复制哈希不要求提交属于当前分支，这些操作在 Merge 提交上也允许。

祖先检查加载期间，Revert 保持禁用，避免状态未确定时误操作。

## 操作流程

### Cherry-pick

- 使用现有 `ipc.cherryPick(repoPath, [oid])`。
- 成功时用返回的 `RepoInfo` 更新当前仓库并刷新仓库查询。
- 冲突时关闭菜单并切换到冲突页，继续/中止使用 `cherry-pick` 流程。

### Revert

- 使用现有 `ipc.revert(repoPath, [oid])`。
- 执行前由后端再次验证 OID 属于当前 `HEAD` 历史。
- 冲突时关闭菜单并切换到冲突页。

### Reset

- 复用 `ResetBranchDialog`。
- 目标名称显示为 `<shortOid> <subject>`，目标 OID 使用完整提交哈希。
- 默认 Mixed，Hard 使用危险样式。
- 成功时用返回的 `RepoInfo` 更新当前仓库。

### 交互式变基

- 设置 `selectedCommit` 为该提交后打开现有 `RebaseDialog`。
- 继续沿用现有计划编辑、冲突跳转和 BackUp Tag 行为。

### 创建并检出分支

- 打开 `PromptDialog`，标题为“从提交创建并检出分支”。
- 默认分支名为 `branch-from-<shortOid>`。
- 名称不能为空。
- 使用 `branchCreate(path, name, true, oid)`，成功后更新 `RepoInfo`。

### 创建标签

- 复用 `TagDialog`。
- `startPoint` 为提交 OID，展示文本包含短 OID 和摘要。
- 轻量标签和附注标签行为保持不变。

### 检出与复制

- 检出使用现有 `commitCheckout`，成功时进入分离头指针。
- 复制使用 `copyTextWithToast`，不修改仓库状态。

## 前端结构

新增共享菜单基础组件：

- `ContextMenuSurface`：遮罩、固定定位容器和滚动边界。
- `ContextMenuItem`：标题、说明、禁用原因、危险样式和点击行为。
- `ContextMenuDivider`：分组分隔线。

`BranchContextMenu` 迁移到这些基础组件，但继续保留分支专属动作。新增 `CommitContextMenu` 只组合提交专属动作。

新增 `clampContextMenuPosition(x, y, width, height, viewport)` 纯函数，放在 `src/lib/contextMenu.ts`，分支和提交菜单共同使用并单独测试。

新增 `useHistoryCommitActions`，放在 `src/features/history/`，负责：

- 当前提交右键菜单状态。
- 祖先检查查询。
- Reset、Tag、Rebase、创建分支等对话框状态。
- Cherry-pick、Revert、Reset、检出和分支创建命令。
- 冲突跳转、toast、`RepoInfo` 更新和统一 invalidation。

`HistoryView` 只负责提交行渲染、选中提交、打开菜单和组合 dialogs，避免继续增加业务命令。

## 数据流

- 右键或键盘打开菜单时调用 `selectCommit(oid)`。
- 菜单打开后通过 `useCommitIsAncestor(repoPath, menu.oid)` 获取 Revert 可用性。
- 按钮操作先关闭菜单，再打开对应对话框或执行命令。
- 所有改变 HEAD 的操作使用 IPC 返回的 `RepoInfo`。
- 所有成功写操作统一调用 `invalidateRepoQueries`。
- 冲突错误统一切换到冲突页。

## 错误处理

- 用户条件不满足时返回现有 `AppError` 或在前端禁用操作并显示原因。
- 祖先检查失败时禁用 Revert，并通过错误 toast 显示错误。
- Cherry-pick/Revert Merge 提交由前端禁用，后端继续作为最终校验。
- Reset、Cherry-pick、Revert 或 Rebase 冲突后保留现有继续/中止流程。
- 点击任何菜单动作后立即关闭右键菜单。
- 创建分支或标签失败时保持对应对话框打开，并通过现有 error toast 展示错误；成功后再关闭对话框。

## 测试

前端测试：

- `clampContextMenuPosition` 覆盖左上、右下、菜单高于视口等边界。
- `ContextMenuItem` 渲染标题、说明、禁用原因和危险样式。
- 分支菜单迁移共享基础组件后，原有全部测试继续通过。
- `CommitContextMenu` 覆盖全部文案和默认可用状态。
- 分离头指针、操作进行中、Merge 提交和祖先加载中时正确禁用。
- 非祖先 Revert 禁用并显示 Cherry-pick 建议。
- 右键提交行先选中再打开菜单。
- `Shift+F10` 和 Context Menu 键打开当前提交菜单。
- 创建分支使用提交 OID 和默认名称。
- 创建标签使用提交 OID 起点。
- Reset、Cherry-pick、Revert 成功后更新 `RepoInfo` 并 invalidation。
- Cherry-pick/Revert 冲突后切换到冲突页。

E2E：

- 右键提交行后菜单包含全部动作。
- Merge 提交的 Cherry-pick/Revert 禁用。
- 打开“在此外创建标签”对话框并确认起点为该提交。
- 打开 Reset 对话框并确认目标短 OID。
- 页面无横向溢出。

## 完成标准

- 提交历史行与分支右键使用一致的菜单视觉和键盘行为。
- 提交业务动作不复制分支菜单的布局代码。
- Merge 提交限制、祖先限制和冲突流程均有自动化测试。
- `docs/CHANGELOG.md` 记录功能和验证结果。
- `npm run test:all`、ESLint、Prettier、Clippy、rustfmt 和 `git diff --check` 全部通过。
