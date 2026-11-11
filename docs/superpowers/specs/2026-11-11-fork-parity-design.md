# GitEasy Fork 对齐设计

- 状态：已批准
- 日期：2026-11-11
- 目标平台：Linux 桌面（X11 / Wayland）
- 产品定位：Linux 原生、功能覆盖 Fork 的桌面 Git 客户端
- 技术路线：Tauri 2 + Rust + React 19 + TypeScript，采用演进式重构

## 1. 背景与目标

Fork 是一款成熟、信息密度高、工作流连贯的 Git 桌面客户端，但目前没有 Linux 版本。GitEasy 已经具备真实可用的 Git 操作能力和统一 IPC，目标是在现有基础上演进为一个能够完全替代 Fork 日常使用的 Linux 原生客户端。

首版目标：

1. 覆盖 Fork 官网列出的完整 Git 工作流。
2. 内置 GitHub 账户、仓库、通知、PR 和 Issue 导航能力。
3. 采用与 Fork 尽量相似的桌面布局、信息密度、操作方式和快捷键习惯。
4. 保留 GitEasy 自身品牌和视觉 token，不直接复制 Fork 的品牌、图标和素材。
5. 保证大仓库、多仓库和复杂操作下的稳定性、响应性与可恢复性。

## 2. 产品范围

### 2.1 范围内

- 仓库创建、克隆、打开、发现、最近仓库、多仓库 Tab 和独立窗口。
- Worktree、Submodule、Repository Manager、Activity Manager 和仓库统计。
- 文件、hunk、行级暂存与取消暂存。
- 提交、amend、sign-off、最近提交信息以及 hooks 输出。
- 统一 / 分栏 diff、忽略空白、词级高亮、大文件按需加载、图片 diff。
- 历史图谱、任意 ref / commit / worktree 比较、文件树浏览、Reflog、Blame、Bisect。
- 分支、Tag、远程、Fetch、Pull、Push、force-with-lease。
- Merge、Rebase、交互式 Rebase、Cherry-pick、Revert、Reset。
- 冲突解决器，包括 ours / base / theirs、冲突块操作和外部合并工具。
- Stash 的创建、部分暂存、查看、应用、弹出、删除、重命名和 Patch 保存。
- Patch 保存、复制、应用和提交范围导出。
- Git LFS 状态、锁定和进度；GPG 签名。
- GitHub OAuth、账户、仓库列表、克隆、通知、PR / Issue 列表与创建 PR。
- 外部编辑器、终端、外部 diff / merge 工具、自定义命令。
- 命令面板、快捷键、主题、无障碍和崩溃恢复。

### 2.2 明确边界

- 不承诺实现超出 Fork 深度的大型 GitHub 代码审查客户端。
- 不在首版实现 Windows / macOS 安装包，但服务边界不得阻碍后续移植。
- 不实现账号云同步、团队协作空间和 Git 托管平台 CI 编排。
- 不进行像素级品牌复刻；界面相似指信息架构、密度、布局和操作习惯。
- 不内置 Git 可执行文件；继续使用系统 Git 和用户已有认证环境。

## 3. 设计原则

### 3.1 工作流优先

Fork 的核心优势不是功能数量，而是把仓库、提交、文件、diff、操作和恢复路径组织在稳定上下文中。所有 UI 改造都必须减少页面跳转和上下文丢失。

### 3.2 按仓库隔离

每个仓库拥有独立会话、写锁、watcher、选中状态、提交草稿、diff 状态、GitHub 视图和操作记录。不能继续把当前仓库、选中文件和弹窗状态作为全局单例。

### 3.3 写操作串行

同一仓库的 stage、commit、checkout、merge、rebase、cherry-pick、revert、reset、pull、push 必须串行执行。不同仓库可以并行。

### 3.4 GitHub 与本地 Git 解耦

GitHub 网络错误、限流、Token 失效和离线状态不能阻塞本地 Git。本地认证继续交给系统 Git credential helper、SSH agent 和已知的 SSH 主机指纹流程。

### 3.5 先模型后页面

先稳定 RepoSession、Ref、Commit、Diff、Worktree、GitHubResource 和 ActivityEvent 模型，再围绕模型构建页面。组件不得直接解析 Git 文本输出。

### 3.6 Fork 相似界面

- 保持顶部仓库 Tab 与全局工具栏。
- 保持左侧仓库/引用导航，中间主列表，右侧检查器，底部状态与操作区。
- 保持高信息密度和可调整面板宽度。
- 常用操作靠近上下文，不依赖大量模态框。
- 保留统一/分栏 diff、文件树、提交详情、比较和冲突的 Fork 式组织。
- 快捷键尽量与 Fork 对齐，同时提供 GitEasy 自己的命令面板映射。

## 4. 系统架构

### 4.1 分层

```text
React Workspace
  Workspace Shell
  Domain Views
  TanStack Query + Zustand
        |
        | typed IPC / events / progress
        v
Rust Core
  WorkspaceService
  RepoSession Registry
  GitRead / GitWrite
  GitHubService
  ActivityLog
        |
        v
System
  Git repositories / system git
  GitHub API
  OS keyring
  Config and repository logs
```

### 4.2 RepoSession

`RepoSession` 是每个仓库的后端运行时对象，至少包含：

- 规范化仓库路径，作为稳定 `repoId`。
- libgit2 Repository 句柄或按需重开策略。
- 异步写锁。
- 独立 watcher 和去抖状态。
- 当前操作状态、取消令牌和进度发送器。
- 仓库级 ActivityLog。
- 最近一次状态版本，用于事件失效。

关闭仓库 Tab 或窗口时必须释放 watcher 与 session。切换 Tab 不重建未关闭仓库的 session。

### 4.3 前端 Workspace

Workspace Shell 负责：

- 仓库 Tab 和窗口级导航。
- 全局命令面板、设置、主题和状态栏。
- 将当前 `repoId` 传给领域视图。
- 保证每个仓库的视图状态互不串扰。

领域视图至少包括：

- Changes 工作台。
- History、Compare、Reflog。
- Conflicts、Rebase。
- GitHub Notifications、Pull Requests、Issues。
- Repository Manager、Activity Manager。

### 4.4 数据流

1. 打开或恢复仓库，规范化路径并创建 `repoId`。
2. 创建或复用 RepoSession，启动 watcher，读取仓库元信息。
3. 视图根据 `repoId + 查询参数` 加载状态、历史、diff 和 GitHub 数据。
4. 写命令进入该仓库的串行锁，长期操作发送进度事件。
5. 写命令完成或 watcher 命中后，只失效当前仓库的相关 Query key。
6. 操作结果、hooks 输出、耗时和错误写入 ActivityLog。

### 4.5 阻塞隔离

libgit2 读取和重计算必须进入 Rust 阻塞线程池。系统 Git 使用异步子进程；长期操作支持进度和取消，取消后回收子进程和临时文件。

### 4.6 错误模型

错误至少区分：

- 认证。
- SSH 主机密钥。
- 冲突。
- 脏工作区。
- 未找到。
- 不支持。
- GitHub 限流 / 网络 / Token。
- IO。
- Git / libgit2。

错误必须包含稳定 code、用户消息、提示、原始详情和可选的恢复动作。GitHub 错误不能伪装成本地 Git 错误。

## 5. 界面设计

### 5.1 主工作区

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 仓库 Tabs                         Fetch Pull Push Command Settings │
├──────────────┬────────────────────────────────┬─────────────────────┤
│ Repository   │ 主工作台                       │ Inspector           │
│ Changes      │ 提交列表 / 变更列表 / Compare  │ Diff / File Tree    │
│ History      │                                │ Commit / GitHub     │
│ GitHub       │                                │                     │
│              │                                │                     │
│ Branches     │ 可折叠提交 / 操作区             │ 上下文动作          │
│ Remotes      │                                │                     │
│ Tags/Stashes │                                │                     │
├──────────────┴────────────────────────────────┴─────────────────────┤
│ 分支 · 变更数 · ahead/behind · 操作状态 · Activity · 版本           │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 视觉方向

- 参考 Fork 的紧凑行高、工具栏、分栏结构和上下文检查器。
- 保留 GitEasy 现有浅色/深色 token、lucide 图标和品牌色。
- 面板可调整宽度，并保存到仓库级设置。
- 1080px、1280px、1440px 和更宽窗口均不得出现不可读挤压、横向溢出或文字重叠。
- 危险动作使用统一确认组件，明确列出对象、影响和恢复建议。

### 5.3 关键交互

- 单击选中，双击执行 Fork 风格的主操作。
- 右键提供仓库、分支、文件、提交、Stash、Worktree 和 Submodule 上下文菜单。
- 选中文件和 diff 使用键盘上下移动，Space 暂存/取消暂存，Ctrl+Enter 提交。
- 面板之间支持 Tab / Shift+Tab 切换。
- 命令面板覆盖高频动作并显示快捷键。
- Toast 只用于反馈，不承担唯一错误说明；错误可在 ActivityLog 中查看详情。

## 6. GitHub 集成

### 6.1 首版能力

- GitHub OAuth Device Flow。
- 多 GitHub 账户元数据。
- 账户下仓库列表、克隆。
- 通知列表、未读状态和跳转。
- Pull Request / Issue 列表、按作者和 Assignee 过滤。
- 创建 Pull Request、打开网页、复制链接。
- PR / Issue / 提交链接与本地分支、提交关联。
- 限流、ETag 缓存、离线降级和手动刷新。

### 6.2 安全

- access token 与 refresh token 存入系统 keyring。
- settings.json 只保存账户标识、登录名、头像 URL 和用户偏好。
- Token 不进入日志、IPC 事件、错误详情或仓库文件。
- GitHub 退出登录必须删除 keyring 中的对应凭据。

## 7. 里程碑与任务

### M0 架构加固与执行基线

- RepoSession 注册表和写锁。
- watcher 生命周期与关闭清理。
- repoId 查询键规范化。
- ActivityLog 基础模型。
- libgit2 读取阻塞隔离。
- 拆分巨型 Sidebar 和单仓库全局状态。

验收：同一仓库并发写串行化；不同仓库并行；关闭仓库释放 session 与 watcher；现有测试和前端构建通过。

### M1 Workspace Shell 与多仓库

- 仓库 Tab、关闭/重开、恢复上次工作区。
- 每仓库独立视图状态。
- 全局命令面板、基础 Activity 面板和错误状态。

验收：同时打开多个仓库；切换 Tab 不串状态；重启恢复 Tab；关闭后 watcher 停止。

### M2 Fork 级变更工作台

- 未暂存/已暂存文件树。
- 完整行级暂存边界。
- 可折叠提交区和最近提交信息。
- 稳定 diff 工具条、大文件加载和词级高亮。

验收：文件列表和常见修改可连续完成暂存、取消暂存、丢弃和提交；1080px 与 1440px 下无重叠。

### M3 历史、比较与恢复

- 历史图谱虚拟滚动、ref 过滤。
- 任意提交文件树。
- 分支、提交、工作区比较。
- Reflog 恢复。
- Stash in graph。
- 文件、目录、选中代码历史。

验收：可恢复丢失提交；可比较两个 ref；可浏览任意提交文件树；大历史滚动无明显卡顿。

### M4 冲突、Rebase、Worktree 与 Submodule

- 重做冲突页信息层级和窄窗口布局。
- Rebase 预览、拖拽、备份、冲突处理。
- Worktree 上下文、切换和关联。
- Submodule 打开、状态与差异。

验收：常见文本冲突可只靠 GitEasy 解决；关键流程有集成测试与恢复路径。

### M5 GitHub 首版集成

- OAuth、keyring、账户与仓库列表。
- 克隆、通知、PR / Issue 列表与筛选。
- 创建 PR、打开网页、限流缓存和离线降级。

验收：GitHub 失效或断网不影响本地 Git；可完成登录、克隆、通知和创建 PR；Token 不进入 settings.json。

### M6 Fork 高级能力补齐

- Patch 保存与应用。
- 图片 diff。
- Git LFS、GPG。
- 外部 diff / merge 工具。
- 自定义命令。
- Bisect、Repository Manager、统计、完整 Activity Manager。

验收：Fork 官网功能清单逐项有实现或明确记录差异；高级能力有独立错误处理和测试。

### M7 发布硬化

- 性能预算和 E2E。
- 视觉回归、键盘、无障碍和崩溃恢复。
- 日志脱敏、安装包升级验证和兼容矩阵。

验收：核心 E2E 全绿；无已知 P0/P1；Ubuntu LTS、Fedora、Arch 的 X11/Wayland 完成基础验证。

## 8. 测试策略

- Rust 单元测试：DTO、错误映射、会话锁、GitHub 缓存、ActivityLog。
- Rust 集成测试：临时仓库覆盖 status、diff、stage、commit、history、branch、conflict、rebase、worktree、submodule。
- 前端单元测试：状态模型、diff 转换、查询键、命令面板和错误展示。
- 组件测试：变更工作台、提交 composer、历史检查器、冲突页和 GitHub 列表。
- E2E：打开多仓库、切换、暂存、提交、比较、Reflog、冲突、GitHub mock。
- 视觉回归：1080px、1280px、1440px 和深色主题。
- 性能预算：中型仓库首屏、大 diff、历史滚动和 watcher 刷新。

## 9. 执行协议

每个任务必须依次满足：

1. 实现存在且范围不越界。
2. 单元或集成测试已添加并通过。
3. TypeScript 构建、Rust 测试和相关检查通过。
4. UI 任务在窄窗口和宽窗口完成截图/视觉检查。
5. CHANGELOG 已记录。
6. 验收条件有可观察证据。

只有六项全部满足，任务才能标记完成并进入下一项。

## 10. 风险

- Fork 功能范围大，必须严格按里程碑执行，避免同时展开多个子系统。
- 现有前端组件过大，M0 必须先拆分关键边界。
- GitHub OAuth、keyring 和缓存需要独立测试，不能阻塞本地 Git。
- 大仓库性能和多仓库 watcher 可能在后期暴露，需从 M0 建立预算和压力测试。
- 与 Fork 相似不等于复制资产；品牌、图标和文案必须保持 GitEasy 自身。

## 11. 完成定义

当 M0–M7 全部完成，GitEasy 应能在 Linux 上覆盖 Fork 的核心 Git 工作流、GitHub 集成和高频桌面操作，并在仓库规模、多仓库、冲突、比较、恢复和可访问性方面没有阻塞日常使用的缺陷。
