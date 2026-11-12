# 变更记录

> 规则：每完成一项功能、修复或交互调整，都必须在本文件追加一条对应记录（日期、变更内容、验证方式）。未记录的工作视为未完成。

## 2026-11-12

### 多平台打包文档

- 新增 `docs/PACKAGING.md`，覆盖 Linux、macOS Apple Silicon 和 Windows 的构建状态、依赖、命令与产物路径。
- macOS CI runner 从已停止支持的 `macos-14` 更新为 arm64 标准标签 `macos-15`。
- macOS 后端测试失败时上传 `macos-backend.log`，便于在未登录 Actions 页面时通过 artifact 获取诊断信息。
- 应用与 DMG 构建失败时上传 `macos-build.log`，保留 Tauri 打包错误。
- 使用 Tauri 图标生成器补充 macOS `icon.icns` 与 Windows `icon.ico`，修复 `Failed to create app icon: No matching IconType`。
- Worktree 含空格路径测试改为比较 canonical path，兼容 macOS `/tmp` 指向 `/private/tmp`。
- Linux 补充 `.deb`、AppImage、RPM 的依赖和构建方式。
- macOS 补充签名、公证 Secret、CI 和产物路径。
- 明确 Windows 当前阻塞项及适配完成后的 NSIS/MSI 目标命令，避免发布不可用安装包。
- 更新 README 和发布检查页，统一链接到完整打包指南。

### 冲突按块解决验证与入口澄清

- 新增 merge 与 diff3 冲突标记解析测试。
- 新增多冲突块逐块采用、全部采用和普通内容保留测试。
- 冲突结果按钮改为“保存并标记已解决”，明确块采用后仍需保存并暂存。
- 验证：前端 22 项测试通过。

### 按文件选择储藏

- 创建储藏改为文件选择弹窗，默认全选，可逐个选择或全选/全不选。
- 后端 `stash_save` 支持路径列表，通过 `git stash push -- <paths>` 只储藏选中文件。
- 自动识别选中的未跟踪文件并传入 `-u`；冲突文件禁止选择。
- 新增路径含空格参数测试和“未选中改动仍保留在工作区”的集成测试。
- 验证：前端 24 项、后端 27 项测试通过，生产构建通过。

### 远程分支层级缩进

- 远程分支树增加相对 remote 父节点的 18px 缩进基准。
- 根级远程分支不再与 remote 名称同级；`origin/feature/ui` 等内部目录继续逐级缩进。
- 新增根级、目录和叶子节点内边距测试，并更新视觉基线。

### Worktree 创建与测试完善

- Worktree 行增加“主/附加”标识，明确区分当前主工作树和其他工作树。
- 添加 Worktree 改为统一创建对话框，支持新建分支或使用已有本地分支。
- 新分支可选择当前 HEAD、本地分支或远程分支作为起点。
- 后端抽出 worktree add/remove 实现，并新增新分支/已有分支参数测试和 add/list/remove 含空格路径往返测试。
- lock/unlock 与 prune 未纳入本轮，作为后续 Worktree 增强项。
- 验证：前端 27 项、后端 29 项测试通过，生产构建与端到端截图回归通过。

### Pull 分叉策略与仓库记忆

- Pull 默认使用 `--ff`，能快进时快进，需要分叉整合时不再直接暴露 Git 配置错误。
- 自动 Pull 会先 Fetch 并检测 ahead/behind；首次发现分叉时显示合并或变基策略对话框。
- 支持勾选按仓库记住 Pull 策略，并通过 Workspace 持久化保存。
- Pull 按钮改为分裂菜单，提供自动、合并、变基和仅快进；命令面板同步增加三种显式策略。
- Pull 产生冲突时自动切换到冲突页，继续复用现有冲突解析、标记和继续操作流程。
- mock 开发模式跳过 Tauri Channel 构造，远程操作可在浏览器预览中执行。
- 验证：前端 18 项测试、后端 25 项测试和 `npm run build` 通过；分叉弹窗与下拉菜单完成桌面和窄窗口截图检查。

## 2026-11-11

### Fork 对齐 M0-01：RepoSession 注册表

- 新增按规范化仓库路径索引的 `RepoSession` 注册表，为每个仓库提供独立写锁。
- 仓库打开与初始化流程会注册或复用对应 session，为后续串行写操作、ActivityLog 和 watcher 生命周期管理提供基础。
- 新增注册表复用和仓库隔离单元测试。
- 验证：`npm run test:backend` 通过，10 项测试全绿；`npm run build` 通过。

### Fork 对齐 M0-02：写操作串行化

- 所有修改仓库状态的命令统一获取对应 RepoSession 写锁，覆盖暂存、提交、分支、远程、Stash、冲突、Patch、Rebase、Worktree 与 Submodule 操作。
- 增加同仓库写锁串行、不同仓库写锁并行的异步测试。
- 测试流程继续直接复用无锁 `*_impl`，避免改变前端 IPC 契约。
- 验证：`npm run test:backend` 通过，12 项测试全绿；`npm run build` 通过。

### Fork 对齐 M0-03：仓库关闭与 watcher 生命周期

- 新增 `repo_close` 命令，关闭仓库时移除 watcher 与 RepoSession。
- 前端关闭当前仓库和切换到另一仓库时调用后端清理；新仓库打开失败时保留原仓库。
- 测试：关闭后 session 与 watcher 均被释放。
- 验证：`npm run test:backend` 通过，13 项测试全绿；`npm run build` 通过。

### Fork 对齐 M0-04：ActivityLog 基础

- 新增仓库级 ActivityLog，记录 Git 子进程命令、开始/结束时间、耗时、结果、输出和错误。
- fetch、pull、push、Rebase 等流式操作与普通 Git 命令使用同一日志入口。
- 对 URL 内嵌凭据进行脱敏，单仓库最多保留 200 条记录。
- 新增 `activity_list` IPC 与前端 DTO。
- 验证：`npm run test:backend` 通过，15 项测试全绿；`npm run build` 通过。

### Fork 对齐 M0-05：libgit2 阻塞隔离

- 状态、diff、提交详情、分支、Tag、远程、Stash、Blame、冲突、子模块和仓库发现改为 `spawn_blocking` 执行。
- 部分暂存补丁解析和 SSH 远程读取同样进入阻塞线程池。
- 新增阻塞任务结果测试，IPC DTO 与调用参数保持不变。
- 验证：`npm run test:backend` 通过，16 项测试全绿；`npm run build` 通过。

### Fork 对齐 M0-06：前端 repoId 状态边界

- TanStack Query 键统一通过 `[domain, repoId, ...params]` 生成。
- Zustand 新增仓库映射与每仓库视图状态，保留当前组件使用的顶层状态作为活动仓库投影。
- 切换仓库会保存并恢复视图、选中文件、暂存侧、提交选择、diff 布局和 Inspector 状态。
- 引入 Vitest 与 `npm run test:frontend`，新增仓库状态隔离和关闭后恢复测试。
- 验证：前端 2 项测试通过；`npm run build` 通过。

### Fork 对齐 M0-07：前端组件拆分

- Sidebar 的分支、远程、Tag、Stash、Submodule、Worktree 拆分为独立组件。
- Stash 预览移入独立 feature 组件；变更提交区、历史图谱和提交详情拆出。
- Sidebar 从 1079 行降至 657 行，ChangesView 和 HistoryView 同步缩小。
- 验证：1440px 变更页与历史页截图检查通过；前端 2 项测试与生产构建通过。

### Fork 对齐 M1-01：WorkspaceStore

- Workspace Store 新增 Tab 顺序与活动仓库，支持打开、激活、关闭、重排和持久化快照。
- 切换 Tab 时保存并恢复每仓库视图状态；关闭 Tab 后释放对应仓库状态。
- 保持现有单仓库调用方式兼容。
- 验证：前端 3 项状态测试通过；生产构建通过。

### Fork 对齐 M1-02：顶栏仓库 Tab

- 顶栏改为仓库 Tab 行与当前仓库工具栏的双层结构。
- Tab 支持点击激活、关闭、中键关闭、拖拽排序，并展示仓库名和分支。
- 打开新仓库不再关闭已有仓库；关闭 Tab 会释放对应 watcher 与 session。
- 验证：1440px 截图检查通过；前端 3 项测试与生产构建通过。

### Fork 对齐 M1-03：工作区恢复

- 工作区快照保存 Tab 顺序、活动仓库、每仓库视图状态和侧边栏宽度。
- Tauri 启动时按快照恢复仓库；失效路径跳过，并在全部恢复失败时显示错误。
- 侧边栏宽度改为按仓库保存，保留旧全局宽度作为兼容回退。
- 验证：新增工作区持久化测试；前端 5 项测试与生产构建通过。

### Fork 对齐 M1-04：全局命令面板

- 命令面板新增仓库切换、关闭仓库、刷新、聚焦提交信息和操作记录入口。
- 保留打开仓库、设置、主题、视图、分支、Stash、终端、Fetch/Pull/Push 命令。
- 验证：生产构建与前端测试通过。

### Fork 对齐 M1-05：Activity 面板

- 新增操作记录弹窗，展示 Git 命令、耗时、结果摘要、时间与输出。
- 支持展开详情、复制脱敏日志和 3 秒自动刷新。
- 顶栏与命令面板均提供入口，开发 Mock 增加示例记录。
- 验证：1440px 截图检查通过；前端 5 项测试与生产构建通过。

### Fork 对齐 M2-01：变更文件树

- 未暂存、已暂存和冲突改为可折叠文件树，支持目录级暂存与取消暂存。
- 文件行支持上下方向键移动、Space 暂存/取消暂存。
- 验证：1440px 截图检查通过；前端测试与生产构建通过。

### Fork 对齐 M2-02：可折叠提交区

- 提交区支持折叠、展开和拖拽调整高度，并按仓库记忆状态。
- 提交框新增最近提交信息下拉选择。
- 验证：展开与折叠截图检查通过；前端测试与生产构建通过。

### Fork 对齐 M2-03：部分暂存边界

- 支持删除文件按选中删除行部分暂存。
- 新增多 hunk 隔离测试和部分删除测试。
- 重命名等不可安全拆分类型返回明确整文件操作提示。
- 验证：后端 18 项测试通过。

### Fork 对齐 M2-04：Diff 工具条

- Diff 支持上下文行数、上/下一处变更、忽略空白、复制路径、外部编辑器和布局切换。
- 工具条在空间不足时横向滚动，不压缩主要操作。
- 验证：1440px 截图检查通过；后端 18 项、前端 7 项测试与生产构建通过。

### Fork 对齐 M2-05：大 Diff 与词级高亮

- 超过 3000 行的差异默认截断，并提供“加载完整差异”。
- 新增 token 级行内差异高亮，并覆盖空行与新增 token 测试。
- 验证：前端 7 项测试与生产构建通过；Mock diff 截图检查通过。

### 分支切换同步修复

- 分支创建、切换、重命名和提交检出命令现在返回最新 RepoInfo。
- 前端切换后同步 Workspace Store，Tab、顶部工具栏和状态栏不再显示旧分支。
- 开发 Mock 支持真实改变当前分支和 detached HEAD 状态。
- 后端集成测试覆盖 `main` 与 `feature/test` 间切换。
- 验证：预览中双击 `feature/ui` 后所有分支标识同步更新；后端 18 项测试通过。

### Fork 对齐 M3-01：历史虚拟滚动

- 提交历史改为 TanStack Virtual 渲染，保留图谱与提交元信息。
- 支持上下方向键在虚拟列表中移动和聚焦，选中提交自动滚动到可见区域。
- 验证：历史页截图检查通过；前端 7 项测试与生产构建通过。

### Fork 对齐 M3-02：Ref 比较

- 新增任意分支、Tag、提交与工作区之间的比较后端。
- 新增比较对话框，显示左右 Ref、OID、文件统计、文件列表和逐文件 diff。
- 支持在比较视图中调整布局、忽略空白和上下文行。
- 验证：分支与工作区比较集成测试通过；后端 19 项测试通过；比较对话框截图检查通过。

### Fork 对齐 M3-03：提交文件树

- 提交详情支持 Changes / File Tree 切换。
- 新增任意提交文件树读取与文件内容读取 IPC，支持目录折叠、文件大小和文本内容。
- 验证：提交树与内容读取集成测试通过；后端 19 项测试与文件树预览检查通过。

### Fork 对齐 M3-04：Reflog

- 新增 Reflog 后端读取与历史恢复对话框。
- 支持选择历史状态、比较、硬重置前二次确认，并在恢复后刷新工作区。
- 验证：Reflog 预览截图检查通过；后端 19 项、前端 7 项测试与生产构建通过。

### Fork 对齐 M3-05：Stash in graph

- Stash 作为固定上下文行显示在提交历史顶部，展示消息、时间和 OID。
- 点击或键盘回车可打开 Stash 预览，继续应用、弹出和删除。
- 过滤提交时自动隐藏 Stash 行；Patch 保存按计划归入 M6-01。
- 验证：历史页 Stash 行与后续提交图谱渲染检查通过。

### Fork 对齐 M3-06：代码行历史

- Diff 选中行后可打开代码行历史，使用 `git log -L start,end:file` 查询。
- Inspector 支持显示行范围、文件历史和 Blame。
- 验证：后端代码行历史集成测试通过；前端构建通过。

### Fork 对齐 M4-01：冲突工作区重设计

- 冲突页改为上方 ours/theirs（可选 base）、下方合并结果的两层布局。
- 1280px 下不再出现竖排文字或横向四列挤压。
- 冲突块采用、全部采用、外部编辑器和标记已解决保持可用。
- 验证：1280px 冲突页截图检查通过；前端 7 项测试与生产构建通过。

### Fork 对齐 M4-02：交互式 Rebase 增强

- Rebase 提交行支持拖拽排序，并保留上下移动按钮。
- 选中提交可预览作者、时间、文件列表和增删统计。
- 新增备份 Tag 开关，变基前对当前 HEAD 创建 `giteasy-backup-*`。
- 验证：Rebase 预览截图检查通过；后端 19 项、前端 7 项测试与生产构建通过。

### Fork 对齐 M4-03/M4-04：Worktree 与 Submodule 入口

- Worktree 支持双击、显式按钮打开，并与当前仓库并列为工作区 Tab。
- Submodule 支持双击和显式按钮打开子仓库。
- Worktree 与每个仓库路径继续使用独立视图状态和侧边栏宽度。
- 验证：前端构建与 7 项测试通过。

### Fork 对齐 M4 收尾：远程 Worktree 与 Submodule 管理

- 远程分支行新增“检出为 Worktree”，支持选择父目录、本地分支和远程起点。
- Submodule 支持添加、移动和删除，删除前提供危险确认。
- Worktree/Submodule 行支持显式打开和双击切换仓库。
- 验证：后端 19 项、前端 7 项测试与生产构建通过。

### Fork 对齐 M5：GitHub 首版集成

- 新增 GitHub 服务、OAuth Device Flow、PAT 登录和系统 Keyring 凭据管理。
- 支持多账户元数据、账户仓库列表、私有仓库识别与克隆。
- 支持通知、Pull Request、Issue 列表，按状态、标题、作者和 Assignee 过滤。
- 新增创建 PR 表单与 GitHub API 限流、认证和网络错误映射。
- API 响应使用 ETag 内存缓存，网络失败时尽量回退缓存。
- 验证：GitHub 远程解析测试通过；后端 20 项、前端 7 项测试与生产构建通过；GitHub 面板截图检查通过。

### Fork 对齐 M6：高级能力补齐

- Patch 工具支持工作区、提交、范围和 Stash 导出，以及复制、保存、校验和应用。
- 图片 diff 支持并排、滑动和洋葱皮三种模式。
- Git LFS 支持状态、文件锁与解锁；GPG 支持设置和提交签名。
- 外部 diff/merge 工具支持多套配置；自定义命令支持 Shell、URL 和变量替换。
- Bisect 支持 good/bad/skip/reset；Repository Manager 支持扫描、重命名、统计和贡献者概览。
- Activity Manager 支持关键词和状态筛选。
- 验证：后端 22 项、前端 7 项测试与生产构建通过。

### Fork 对齐 M7：发布硬化

- 新增 React Testing Library + jsdom 组件测试，前端测试扩展至 9 项。
- 新增 Selenium + geckodriver E2E，覆盖变更、历史、冲突、深色主题和 GitHub 面板。
- 生成 1080/1280/1440 与深色主题视觉基线；E2E 检查布局溢出为 0。
- 新增中型历史基准，80 次提交下分页查询通过。
- 可选面板改为按需加载，首屏 JS 从约 512KB 降至 466KB。
- 新增 `README.md`、`docs/RELEASE.md`、`npm run test:all` 和 `npm run test:perf`。
- 成功生成并校验 `.deb`：GitEasy 0.1.0 amd64，3.2MB，含桌面入口、图标和 `/usr/bin/giteasy`。
- 验证：前端 9 项、后端 23 项、E2E 与生产构建全部通过。

### macOS Apple Silicon 构建支持

- 增加 macOS 专属 Tauri 配置，目标为 `.app` 和 `.dmg`，最低 macOS 11。
- Keyring 依赖按 Linux/macOS 平台分别启用 Secret Service 和 Apple Keychain。
- 外部打开和默认终端行为适配 macOS `open` / `Terminal`。
- 新增 `scripts/build-macos-arm64.sh` 和 GitHub Actions Apple Silicon 构建工作流。
- 当前 Linux 环境缺少 Apple SDK/Xcode，因此不能在本机直接生成可运行的 macOS 安装包。

### 远程分支路径与历史文件树修复

- 远程分支检出不再取最后一段作为本地分支名，`origin/feature/nested` 会创建 `feature/nested`。
- 开发 Mock 同步保留远程分支的完整子路径。
- 提交详情的修改文件从平铺列表改为可折叠目录树，显示目录文件数和聚合增删行。
- 历史详情的提交操作收进“更多”菜单，Changes / File Tree 与主操作合并到同一工具栏。
- 历史详情使用紧凑 Diff 工具条，上下文、空白、布局、历史和 Blame 收进“显示”菜单。
- 提交列表宽度改为受控范围，为详情检查器留出更多空间。
- 验证：新增远程嵌套分支命名测试；后端 24 项、前端 9 项测试通过。

## 2026-10-31

### 初始交付：M0–M4

- M0：Tauri 2 + React 19 + TypeScript + Vite + Tailwind 4 工程骨架、设计 token、三栏布局。
- M1：仓库打开/初始化/发现接口、变更列表、统一/分栏 diff、历史图谱、提交详情、文件历史、Blame。
- M2：文件/hunk/行级暂存、取消暂存、提交/amend/sign-off、分支操作、fetch/pull/push 进度、系统 git 认证。
- M3：冲突三栏解决、stash 预览与应用/弹出、tag、cherry-pick/revert/reset、子模块、工作树。
- M4：浅色/深色主题、命令面板、快捷键、设置中心、文件监听自动刷新、`.deb` 打包。
- 验证：`cargo test` 2 项通过；`npm run build` 通过；`.deb` 产物 2.08 MB。

### 交互调整

- 分支切换改为双击触发，单击仅选中；本地与远程分支一致。
- Toast 通知统一 10 秒后自动消失（含错误提示）。
- 侧边栏宽度支持拖拽调整（220–460px），写入 `localStorage` 持久化。

### 后续功能批次一

- diff 头部新增「在外部编辑器中打开」。
- 历史/提交 diff 支持「忽略空白」切换。
- 历史支持按作者、按路径过滤。
- 提交框新增 Conventional Commit 辅助（type / scope / 描述）。
- 新增构建脚本 `scripts/build.sh`，为缺少 GTK 开发软链的环境自动生成链接垫片；新增 `npm run build:app`、`npm run test:backend`。

### 后续功能批次二

- 远程管理：新增 `RemotesDialog`，支持查看、新增、删除 remote。
- 仓库发现：新增 `DiscoverDialog`，扫描指定目录（最多 3 层）并打开子仓库。
- Tag 完整化：新增附注标签创建对话框；支持标签检出、推送、删除。
- 远程分支删除：远程分支行内操作，调用 `git push <remote> --delete`，带二次确认。
- 提交 hooks 输出：`commit_create` 返回 `{ oid, output }`，提交成功后可展开查看 hooks 输出。
- 验证：`npm run build` 通过；`npm run test:backend` 2 项通过；`.deb` 重新打包。

### 推送修复

- `push` / `pull` 命令新增 `remote` 与 `branch` 参数。
- 分支尚未设置上游时，推送自动执行 `git push -u <remote> <branch>` 建立跟踪，解决“添加远程后无法推送”。
- 推送菜单新增「指定远程」列表，可显式选择目标 remote。
- 无远程仓库、分离头指针场景给出明确错误提示；命令结束后立即清理进度状态。
- 验证：新增 `push_args` 单测，`cargo test` 3 项通过；本地 bare remote 实测推送成功且 upstream 为 `origin/main`；`npm run build` 通过。

### 远程交互整合

- 侧边栏新增「远程」分区，与「标签」「储藏」同级，展示 remote 列表，支持行内删除与 `+` 添加。
- 移除仓库下拉菜单中的「管理远程…」入口，避免重复。
- 本地分支右键新增「Push 到远程…」：弹窗内可选择远程、选择已有远程分支，或输入新的远程分支名直接创建；支持「推送后设置为上游」与 force-with-lease。
- 后端 `push` 支持 `local:remote` refspec，可将本地分支推送到任意远程分支名。
- 验证：`npm run build` 通过；`cargo test` 3 项通过（含 refspec 参数用例）。

### SSH 推送诊断与主机指纹确认

- 定位 Gitee 推送失败原因：`gitee.com` 主机密钥未在 `known_hosts` 中（`Host key verification failed`），且本机 `~/.ssh/id_rsa` 未获 Gitee 授权（`Permission denied (publickey)`）。
- 新增后端命令：`ssh_probe_remote`（ssh-keyscan + ssh-keygen 读取主机指纹）、`ssh_trust_remote`（确认后写入 `~/.ssh/known_hosts`）、`ssh_public_key`（读取本机 SSH 公钥）。
- 新增「确认 SSH 主机密钥」弹窗：展示主机指纹，用户确认后写入 known_hosts 并自动重试原推送。
- 设置中心新增「SSH 公钥」区域，展示公钥路径与内容，支持一键复制。
- 认证错误提示细化：区分主机密钥未信任、主机密钥变更（疑似中间人）、SSH 公钥未授权、HTTPS 凭据失败。
- 验证：`ssh-keyscan` 与 `ssh-keygen -lf` 实测可读取 gitee.com 指纹；`cargo test` 4 项通过；`npm run build` 通过。

### 远程分支合并进「远程」分区

- 移除分支分区内原有的「远程分支」折叠列表，避免与「远程」分区重复展示。
- 「远程」分区改为按 remote 分组：每个 remote 为可折叠父节点，展开后列出该 remote 下的远程分支（显示去掉 `<remote>/` 前缀的短名）。
- 远程分支保留双击检出、行内删除（`git push <remote> --delete`）能力。
- 验证：`npm run build` 通过；DEV mock 环境截图确认 `origin` 分组可展开并正确展示 `main`。

### 交互式变基

- 后端新增 `rebase_todo`：读取 `base..HEAD` 范围内（最多 200 条）的提交，按时间正序返回。
- 后端新增 `rebase_start`：将前端提交的计划写入临时 todo 文件，通过 `GIT_SEQUENCE_EDITOR` 注入后执行 `git rebase -i`。
- 支持动作：`pick`、`reword`（追加 `exec git commit --amend -F`）、`squash`、`fixup`、`drop`，以及通过上移/下移调整提交顺序。
- 校验：第一个有效提交不能为 squash/fixup；至少保留一个提交；reword 必须填写提交信息。
- 前端新增「交互式变基」对话框，从历史视图提交详情打开；变基产生冲突时自动切换到「冲突」视图继续处理。
- 验证：新增 todo 生成单测与 `rebase_todo` 集成测试；外部临时仓库实测 fixup 合并与 reword 改写成功；`cargo test` 8 项通过；`npm run build` 通过。

### 冲突解决增强

- 冲突视图新增「base 对照」开关，可显示共同祖先版本（diff3 的 base 区）。
- 解析工作区冲突标记（兼容 merge 与 diff3 风格），按冲突块展示「我的 / 对方」内容。
- 每个冲突块支持「采用我的 / 采用对方 / 两者保留」，并提供全部采用、全部保留的批量操作，结果仍可在编辑器中继续微调。
- 验证：使用 mock 冲突内容渲染冲突块面板；`npm run build` 通过。

### 新增文件按行暂存

- 后端 `apply_selection` 支持未跟踪/新增文件：生成带 `new file mode` 与 `/dev/null` 头的补丁，通过 `git apply --cached` 只把选中行写入暂存区。
- 变更视图对未跟踪文件开放按行/按块暂存入口；工作区文件保持完整内容，未选中的行保留为未暂存改动。
- 验证：新增集成测试 `partial_staging_new_file_takes_selected_lines`，确认暂存结果为选中行且工作区不变；`cargo test` 8 项通过。

### 本机安装（当前用户）

- 将 `.deb` 解包安装到 `~/.local/opt/giteasy/giteasy`，并在 `~/.local/bin/giteasy` 建立命令入口。
- 安装图标到 `~/.local/share/icons/hicolor/*/apps/giteasy.png`，桌面入口写入 `~/.local/share/applications/GitEasy.desktop`（Exec 指向用户目录）。
- 验证：`~/.local/bin/giteasy` 可正常启动，进程路径为安装目录；应用菜单可通过 GitEasy 启动。
- 说明：系统级安装需 root 权限，当前 sudo 需要交互密码，故采用用户级安装。

### 历史详情降噪

- 历史页默认使用统一 diff，不再沿用全局左右分栏设置，避免提交详情被压缩。
- 提交详情新增「专注详情」模式，可隐藏提交列表并让文件树和 diff 占满工作区；再次点击可恢复列表。
- 文件列表与 diff 之间新增可拖动高度分隔线，并按仓库记住高度；双击可恢复默认高度。
- 分栏 diff 改为共享列宽网格，移除逐行横向滚动条；横向滚动统一放在 diff 区域底部。
- 修复分栏 diff 中鼠标移入代码时行高和容器高度抖动的问题。
- 新增专注模式视觉基线，并更新 1440px 历史页基线。
- 验证：前端测试、后端测试、生产构建与 E2E 视觉回归通过。

### 移除分栏 diff

- 完全移除分栏视图入口、分栏渲染、布局状态和相关样式，工作区、历史、比较与 Stash 统一使用单栏 diff。
- 旧工作区快照中的 `diffLayout` 字段在载入时丢弃，不会再次恢复分栏模式。
- 删除分栏视觉基线，并新增“显示菜单中不再存在分栏选项”的 E2E 检查。
- 验证：前端测试、生产构建与 E2E 视觉回归通过。

### 修复 diff 纵向滚动

- 为 diff 容器补上 flex 纵向收缩约束并限制外层溢出，长文件现在由内部内容区正常上下滚动。
- E2E 新增长内容滚动检查，确认 `scrollHeight` 超出可视高度后 `scrollTop` 可以变化。
- 验证：前端测试、生产构建与 E2E 通过。

### 修复 diff 行背景宽度

- diff 行现在至少铺满可视区域，并在代码横向超宽时扩展到完整内容宽度，新增/删除行的绿色与红色背景不再中途截断。
- E2E 将代码扩展到 500 个字符后检查行宽，确认行背景覆盖整个横向滚动内容。
- 验证：前端测试、生产构建与 E2E 通过。

### 修复 WebKit diff 行背景宽度

- 不再依赖 WebKit 对百分比与 `max-content` 的组合解析，改为读取 diff 实际可视/滚动宽度并写入像素级 CSS 变量。
- hunk 标题、新增行与删除行都使用同一实际内容宽度，历史详情中红绿背景可铺满整行。
- E2E 新增历史详情行宽断言，并要求计算后的 `min-width` 为像素值。
- 验证：前端测试、生产构建与 E2E 通过。

### 分支树形显示

- 本地分支和远程分支均按 `/` 拆分为可展开、折叠的目录树，目录显示后代分支数量。
- 叶子节点保留当前分支高亮、ahead/behind、双击检出、右键菜单及远程分支 Worktree/删除操作。
- 新增分支树层级构建与目录折叠测试，以及侧边栏折叠/展开 E2E 检查。
- 验证：前端 13 项测试、生产构建与 E2E 视觉回归通过。
