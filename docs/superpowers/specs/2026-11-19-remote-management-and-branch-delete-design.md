# 远程管理与远程分支删除修复设计

## 目标

- 用户可以修改现有 Git remote 的名称和 URL。
- 用户可以从仓库菜单和远程区域进入完整远程管理界面。
- 修复多层远程分支删除时只传叶子名的问题。
- 使用真实 `test` 仓库验证 remote 配置修改和多层远程分支删除。

## 非目标

- 不删除远程服务器上的仓库。
- 不管理凭据、SSH key 或 credential helper。
- 不增加多个 push URL 或 fetch URL 的独立编辑。
- 不重构远程分支树拓扑。

## 远程管理交互

- 仓库切换菜单增加“管理远程…”。
- 远程区域入口进入完整管理界面，不再只显示新增表单。
- 完整管理界面包含：
  - 当前 remote 列表。
  - 每项名称和 URL。
  - 编辑按钮。
  - 删除按钮。
  - 新增 remote 表单。
- 编辑现有 remote 时展示独立表单：
  - 预填当前名称和 URL。
  - 名称和 URL 都可修改。
  - 保存或取消。
- 名称为空或 URL 为空时禁止提交，并由后端再次校验。
- 删除 remote 仍只删除本地 remote 配置，不删除远程服务器仓库。

## 后端 remote_update

- 新增 `remote_update` Tauri command。
- command 获取仓库写锁后调用 `remote_update_impl`。
- 输入包含旧名称、新名称和新 URL。
- 执行顺序：
  1. 校验输入。
  2. 如果名称变化，执行 `git remote rename <old> <new>`。
  3. 如果 URL 变化，使用修改后的名称执行 `git remote set-url <name> <url>`。
- 改名成功但 URL 修改失败时，错误信息明确说明“remote 名称已修改，但 URL 未修改”。
- 不把远程连通性校验混入 set-url；Git 允许设置暂时不可访问的 URL。

## 远程分支删除修复

- 远程分支树只负责显示层级，不负责决定 Git 分支名。
- 删除远程分支时根据完整 `branch.name` 和 `remote.name` 计算：

```text
branch.name.slice(remote.name.length + 1)
```

- 例如：
  - remote: `gitee`
  - branch: `gitee/feature/login`
  - 删除参数必须是 `feature/login`。
- 不能再使用树形节点的叶子显示名 `login`。
- 删除确认框继续展示完整 remote 和远程分支名。

## 组件边界

- `src/features/repo/RemotesDialog.tsx` 负责完整远程管理界面。
- `src/components/sidebar/SidebarRepoMenu.tsx` 只增加管理入口回调。
- `src/components/Sidebar.tsx` 管理新增模式和完整管理模式。
- `src/components/sidebar/SidebarSections.tsx` 负责展示远程分支并传入完整删除参数。
- `src/lib/ipc.ts` 增加 `remoteUpdate`。
- `src-tauri/src/write.rs` 提供可测试的远程增删改 impl。

## 错误处理

- remote 名称重复时显示 Git 错误，不覆盖现有 remote。
- remote 改名失败时不继续修改 URL。
- URL 修改失败时保留已完成的改名，并报告部分完成状态。
- 删除不存在的远程分支时显示 Git 返回的错误。
- 远程删除成功后统一 invalidate remotes 和 branches。

## 测试

### 前端

- RemotesDialog 显示现有 remote。
- 编辑按钮预填名称和 URL。
- 保存调用 `remoteUpdate`。
- 取消不调用 IPC。
- 新增和删除 remote 的现有行为不回归。
- 多层远程分支删除传入完整 `feature/login`。
- 仓库菜单能够打开完整远程管理界面。

### Rust

- remote 新增、改名、URL 修改和删除。
- 空名称、空 URL 被拒绝。
- 改名成功但 URL 修改失败时返回部分完成错误。
- remote 删除只影响本地配置。

### 真实仓库验收

- 使用 `/home/kerwin/workspace/python/test`。
- 添加一个临时 remote。
- 修改临时 remote 的名称和 URL。
- 删除临时 remote。
- 确认原有 `gitee` remote 未被修改。
- 在 `gitee` 上创建并推送临时多层分支。
- 通过实际后端删除该远程分支。
- 确认多层分支在本地 remote-tracking refs 和远程服务器上均被清理。

## 验收标准

- 用户可以编辑 remote 名称和 URL。
- 远程区域和仓库菜单都能进入完整远程管理。
- 多层远程分支可以正确删除。
- 错误信息能够区分完全失败和部分完成。
- `npm run test:all` 和静态检查通过。
