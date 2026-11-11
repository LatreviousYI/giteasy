# GitEasy 设计文档

- 状态：待评审
- 日期：2026-10-31
- 目标平台：Linux 桌面（X11 / Wayland）
- 技术栈：Tauri 2 + Rust + React 19 + TypeScript

## 1. 背景与目标

Linux 桌面缺少一款界面精致、功能完整的 Git GUI。现有工具要么停留在维护模式，要么交互陈旧，要么在 Linux 上依赖笨重的运行时。GitEasy 的目标是：

1. 提供覆盖日常与进阶 Git 工作流的完整图形客户端，用户无需回到命令行。
2. 以浅色清爽风格为主视觉，兼顾长时间使用的信息密度与可读性。
3. 启动快、内存低、操作响应在毫秒级，大仓库不卡顿。
4. 完全复用用户已有的 Git 配置、凭据与 hooks，不改变其工作习惯。

## 2. 范围

### 2.1 范围内

- 仓库打开、最近仓库、仓库发现
- 工作区变更查看，文件级 / hunk 级 / 行级暂存与撤销
- 提交、amend、提交模板、Conventional Commit 辅助、hooks 输出回显
- 历史图谱、提交详情、单文件 diff、文件历史、blame
- 分支、标签、Stash 管理
- 远程 fetch / pull / push，实时进度；系统 git 认证
- 冲突解决（merge / rebase / cherry-pick 三种场景）
- cherry-pick / revert / reset（soft / mixed / hard）
- Submodule 状态与更新、Git LFS 状态提示
- Worktree 管理
- 命令面板、快捷键、浅色/深色双主题、设置中心
- 打包为 `.deb` 与 `.AppImage`，支持自动更新

### 2.2 范围外

- GitHub / GitLab 等托管的 PR、Issue、CI 集成
- 内置代码编辑器（只提供跳转外部编辑器）
- Windows / macOS 适配（架构预留，不在首版交付）
- 交互式 rebase 可视化编排（延后至 M4 之后，见 13 节）
- 账号体系、云同步、团队协作功能

## 3. 技术决策

### 3.1 Git 后端：混合方案（已确认）

采用 `GitBackend` 抽象，读路径走 libgit2，写路径与复杂操作走系统 git CLI。

| 能力 | 实现 | 理由 |
|---|---|---|
| status / diff / log / blame / refs | libgit2（`git2-rs`） | 结构化数据、毫秒级、无需解析文本 |
| commit | git CLI | 正确触发 pre-commit / commit-msg 等 hooks，兼容 husky |
| merge / rebase / cherry-pick / revert / reset | git CLI | libgit2 行为与原生 git 存在差异，复用 CLI 保证一致 |
| fetch / pull / push | git CLI | 天然支持 credential helper、SSH agent、进度输出、LFS |
| submodule / LFS | git CLI | libgit2 支持不完整 |

约束：

- 系统必须安装 git（启动时检测版本，低于 2.30 给出明确提示）。
- 不读取、不缓存任何凭据；认证完全交给系统 git。
- 混合层通过统一 trait 暴露，业务命令不感知实现差异。

### 3.2 前端

| 领域 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS 4 + CSS 变量设计 token |
| 组件原语 | Radix UI（无障碍、焦点管理） |
| 图标 | lucide-react |
| 动效 | Framer Motion（仅用于面板切换与轻量反馈） |
| 服务端状态 | TanStack Query 5 |
| 客户端状态 | Zustand 5 |
| 虚拟列表 | TanStack Virtual |
| diff 渲染 | 自建虚拟滚动 diff 视图（统一/分栏、词级） |
| 冲突解决 | CodeMirror 6 merge 扩展（三栏） |
| 历史图谱 | 前端计算 lane + SVG 渲染 + 虚拟列表 |
| 测试 | Vitest + Testing Library + Playwright |

### 3.3 Rust 侧关键依赖

- `git2`：libgit2 绑定
- `tokio`：异步运行时，CLI 进程管理与阻塞任务调度
- `notify`：文件系统监听
- `serde` / `specta`（或 `ts-rs`）：DTO 与 TS 类型自动生成
- `thiserror`：错误建模
- `tempfile`（dev）：测试用临时仓库

## 4. 系统架构

```
┌──────────────── React 前端 (WebView) ────────────────┐
│  UI 层：Radix + Tailwind + Framer Motion              │
│  状态层：Zustand(UI) + TanStack Query(仓库数据)        │
│  数据层：typed IPC client（编译期校验 DTO）             │
└───────────────────┬──────────────────────────────────┘
                    │ Tauri invoke / event / channel
┌───────────────────▼──────────────────────────────────┐
│ Rust Core                                             │
│  commands/  一个用例一个命令，强类型入参/返回值          │
│  core/      RepoSession(每仓库写锁)、watcher、auth、错误 │
│  git/       GitBackend trait → Libgit2Read / GitCliWrite│
└──────────────────────────────────────────────────────┘
```

### 4.1 多仓库会话

- `RepoSession` 保存仓库路径、libgit2 `Repository` 句柄、写操作锁、watcher 句柄。
- 同一仓库的写操作串行执行（`tokio::Mutex`），避免并发写 index 导致损坏。
- 不同仓库互不阻塞。
- 关闭仓库时释放句柄并停止 watcher。

### 4.2 文件监听

- `notify` 监听 `.git/` 与工作区，300ms 去抖。
- 变化后广播 `repo://changed` 事件，携带变更类型（工作区 / refs / index）。
- 前端据此失效对应 Query key，不整页刷新。
- 忽略 `.git/objects` 等高频目录，避免噪声。

### 4.3 长任务与进度

- fetch / pull / push / clone 通过 Tauri Channel 流式回传进度对象：阶段、已处理对象数、总量、百分比、速率。
- 支持取消：终止子进程并回传取消状态。
- 命令输出同时落盘到仓库级日志，供「查看原始输出」入口使用。

### 4.4 线程与阻塞隔离

- 所有 libgit2 调用通过 `spawn_blocking` 执行，不阻塞 async 运行时与 UI。
- CLI 子进程由 `tokio::process` 管理，标准输出与标准错误分开采集。
- 大 diff、blame 等重计算支持上限保护（见 9 节）。

## 5. 目录结构

```
git_easy/
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs
│  │  ├─ commands/
│  │  │  ├─ repo.rs        # 打开/关闭/最近仓库/发现
│  │  │  ├─ status.rs
│  │  │  ├─ diff.rs
│  │  │  ├─ log.rs
│  │  │  ├─ commit.rs
│  │  │  ├─ branch.rs
│  │  │  ├─ remote.rs
│  │  │  ├─ stash.rs
│  │  │  ├─ tag.rs
│  │  │  ├─ conflict.rs
│  │  │  ├─ submodule.rs
│  │  │  └─ settings.rs
│  │  ├─ core/
│  │  │  ├─ session.rs
│  │  │  ├─ discovery.rs
│  │  │  ├─ watcher.rs
│  │  │  ├─ auth.rs
│  │  │  └─ error.rs
│  │  └─ git/
│  │     ├─ backend.rs     # trait + 统一 DTO
│  │     ├─ libgit2.rs
│  │     ├─ cli.rs
│  │     └─ dto.rs
│  └─ tauri.conf.json
├─ src/
│  ├─ app/                 # 布局、路由、Provider
│  ├─ features/
│  │  ├─ changes/
│  │  ├─ history/
│  │  ├─ diff/
│  │  ├─ branches/
│  │  ├─ stash/
│  │  ├─ tags/
│  │  ├─ conflict/
│  │  ├─ settings/
│  │  └─ palette/
│  ├─ components/ui/       # 设计系统原子组件
│  ├─ lib/                 # ipc、query、format、shortcuts
│  └─ styles/tokens.css
└─ docs/
```

## 6. IPC 契约

### 6.1 命令清单（按域）

| 域 | 命令 |
|---|---|
| 仓库 | `repo_open`、`repo_close`、`repo_recent`、`repo_discover` |
| 状态 | `status_get` |
| 变更 | `stage_paths`、`unstage_paths`、`discard_paths`、`stage_hunks`、`stage_lines` |
| 提交 | `commit_create`、`commit_amend`、`commit_detail` |
| 历史 | `log_query`、`file_history`、`blame_get` |
| diff | `diff_workdir`、`diff_commit`、`diff_range` |
| 分支 | `branch_list`、`branch_create`、`branch_checkout`、`branch_delete`、`branch_rename`、`branch_set_upstream` |
| 远程 | `remote_list`、`remote_add`、`remote_remove`、`fetch`、`pull`、`push` |
| Stash | `stash_list`、`stash_save`、`stash_apply`、`stash_pop`、`stash_drop`、`stash_show` |
| Tag | `tag_list`、`tag_create`、`tag_delete` |
| 操作 | `cherry_pick`、`revert`、`reset` |
| 冲突 | `conflict_list`、`conflict_resolve`、`merge_abort`、`merge_continue`、`rebase_continue` |
| Submodule | `submodule_list`、`submodule_update` |
| 设置 | `settings_get`、`settings_set`、`open_in_editor`、`open_in_terminal` |

### 6.2 DTO 约定

- 全部结构体 `#[serde(rename_all = "camelCase")]`。
- 时间统一为 Unix 秒 + 时区偏移，前端负责本地化。
- 提交对象包含：OID、父提交数组、作者、提交者、时间、标题、正文、refs、lane 信息（由 `log_query` 计算）。
- diff 对象结构：

```ts
interface DiffDto {
  path: string
  oldPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'conflicted'
  binary: boolean
  hunks: HunkDto[]
}
interface HunkDto {
  header: string
  oldStart: number
  newStart: number
  lines: DiffLineDto[]
}
interface DiffLineDto {
  kind: 'context' | 'add' | 'del'
  oldLineNo?: number
  newLineNo?: number
  content: string
}
```

### 6.3 错误模型

```rust
pub enum ErrorKind {
    Auth,          // 认证失败
    Conflict,      // 冲突未解决
    DirtyWorkdir,  // 工作区不干净
    NotFound,      // 仓库/分支/提交不存在
    Unsupported,   // 当前 git 版本不支持
    Io,
    Git,
}

pub struct AppError {
    pub kind: ErrorKind,
    pub code: String,     // 稳定错误码，供前端分支处理
    pub message: String,  // 面向用户的中文描述
    pub hint: Option<String>, // 可执行建议
    pub detail: Option<String>, // 原始 git/libgit2 输出，默认折叠
}
```

前端按 `kind` 决定交互：Auth 引导检查凭据配置；Conflict 跳转冲突解决器；DirtyWorkdir 提示先提交或 stash；Git 展示 `detail` 并提供复制。

## 7. 前端设计系统

### 7.1 设计 token（浅色）

```css
:root {
  --bg: #FAFAFB;
  --surface: #FFFFFF;
  --surface-hover: #F3F4F6;
  --border: #E9EAEE;
  --border-strong: #D8DAE0;
  --text: #1F2328;
  --text-muted: #6B7280;
  --text-subtle: #9CA3AF;
  --accent: #5B6CFF;
  --accent-hover: #4A5AF0;
  --accent-soft: #EEF0FF;
  --add-bg: #E8F7EE;
  --add-fg: #1A7F37;
  --del-bg: #FDECEC;
  --del-fg: #CF222E;
  --warn-bg: #FFF6E5;
  --warn-fg: #9A6700;
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 14px;
  --row-h: 30px;
  --font-ui: "Inter", "Noto Sans SC", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;
  --shadow-pop: 0 8px 24px rgba(17, 24, 39, 0.08);
  --dur-fast: 120ms;
  --dur: 150ms;
}
```

深色主题覆盖同名变量，由 `prefers-color-scheme` 驱动，设置中可强制。

### 7.2 布局

```
┌──────────────────────────────────────────────────────────────┐
│  Repo ▾   ⎇ main ↑2 ↓1    [Fetch] [Pull] [Push]    ⌘K  ⚙     │
├───────────┬──────────────────────────────┬───────────────────┤
│ 变更 (12) │  History 图谱                 │ 提交详情 / Diff    │
│ ───────── │  ●─┐ feat: 新增登录页  a1b2c3  │ 作者 · 时间        │
│ ● 已暂存  │  │ ● fix: 修复空指针     d4e5f6 │ 文件列表 (3)       │
│ ● 未暂存  │  ●─┘ merge: 合并 dev     ...   │ ─────────────     │
│           │                              │ 代码 diff（分栏）  │
│ 分支      │  （虚拟滚动，500/页）          │ 行内/词级高亮      │
│ 标签      │                              │                   │
│ 储藏      │                              │                   │
├───────────┴──────────────────────────────┴───────────────────┤
│  ⎇ main · 干净 · libgit2 2.3ms · UTF-8                        │
└──────────────────────────────────────────────────────────────┘
```

- 左栏可折叠，宽度 240px；中栏自适应；右栏 420px 可拖拽。
- 变更视图与历史视图通过顶部 Tab 切换，保留各自滚动位置。
- 底部状态栏展示当前分支、工作区状态、后端耗时、编码，异常时变为错误入口。

### 7.3 交互规范

- 键盘优先：`Ctrl+K` 命令面板、`Ctrl+Enter` 提交、`↑/↓` 切换提交、`Space` 暂存选中文件、`Ctrl+Shift+P` 推送。
- 危险操作二次确认，弹窗内明确列出受影响对象；丢弃改动前提供「先 stash」选项。
- 长操作显示非阻塞进度胶囊，可后台继续浏览其他仓库。
- Toast 分级：成功静默（仅状态栏反馈）、警告常驻 5s、错误常驻并提供展开详情。

## 8. 功能规格与验收

### P0 核心闭环

| 功能 | 验收标准 |
|---|---|
| 打开仓库 | 支持选择目录、拖入窗口、最近仓库列表；无效目录给出明确原因 |
| 变更列表 | 正确区分已暂存/未暂存/未跟踪/冲突；显示文件状态图标；刷新 < 100ms |
| 行级暂存 | hunk 与单行可暂存/取消暂存；操作后 index 与 git CLI 一致 |
| 提交 | 支持多行消息、amend、signoff；hooks 失败时原样回显输出且保留输入 |
| 历史图谱 | 正确渲染分支合并与分离头指针；500 条/页增量加载；滚动流畅 |
| diff 查看 | 统一/分栏切换、忽略空白、词级高亮；大文件虚拟滚动 |
| 分支操作 | 创建/切换/删除/重命名/设置上游；删除未合并分支需强确认 |
| 远程操作 | fetch/pull/push 实时进度；force-with-lease 需显式确认 |

### P1 完整客户端

| 功能 | 验收标准 |
|---|---|
| 冲突解决 | merge/rebase/cherry-pick 冲突可三栏编辑；支持整块采纳、逐行编辑、标记已解决 |
| Stash | 保存（可含未跟踪）、应用、弹出、删除、查看 diff |
| Tag | 轻量/附注标签创建与删除，可推送 |
| cherry-pick / revert / reset | 三种 reset 模式明确说明后果；冲突后可继续或中止 |
| 文件历史 / blame | 按路径过滤历史；blame 按行显示提交与作者 |
| 设置中心 | 主题、字号、外部编辑器、终端、提交身份；修改即时生效 |

### P2 进阶

| 功能 | 验收标准 |
|---|---|
| 交互式 rebase | 不在本次范围，M4 之后单独立项，见 13 节 |
| Submodule | 列出状态、初始化、更新、打开子仓库 |
| LFS | 标记 LFS 跟踪文件，缺失对象给出提示 |
| Worktree | 列出、创建、删除、在新窗口打开 |
| 命令面板 | 覆盖全部高频动作，支持模糊搜索与快捷键提示 |

## 9. 性能策略

| 场景 | 策略 | 目标 |
|---|---|---|
| 首屏 | status + 首页 log 并行请求，虚拟列表懒渲染 | 中型仓库（1 万提交）< 500ms |
| 变更刷新 | watcher 去抖 + 增量 status | < 100ms |
| 历史滚动 | 分页 500 条 + lane 增量计算 + 虚拟滚动 | 单页 < 150ms |
| diff | 按文件/按需加载，超过 5000 行截断并提供「完整加载」 | 打开 < 100ms |
| 巨型文件 / 二进制 | 后端判定 binary，前端只显示元信息 | 不阻塞 UI |
| 内存 | 关闭仓库即释放句柄；log 页最多保留 5000 条 | 常驻 < 300MB |
| 大仓库 | 提示浅克隆/稀疏检出建议；禁用全量 blame | 不出现无响应 |

## 10. 安全与数据保护

- 不持久化任何凭据、token；认证交由系统 git credential helper / SSH agent。
- 日志与错误详情中对 URL 内嵌凭据脱敏。
- 所有破坏性操作（`reset --hard`、强推、删分支、丢弃改动）必须二次确认，并展示受影响对象清单。
- 丢弃改动前默认建议 stash；提供全局「操作记录」，可查看最近写操作并回滚（基于 reflog）。
- 不在用户仓库执行自动 `gc`、`prune` 等维护命令。

## 11. 测试策略

| 层级 | 内容 | 工具 |
|---|---|---|
| Rust 单元 | DTO 转换、错误映射、lane 计算 | `cargo test` |
| Rust 集成 | 临时仓库覆盖 status/diff/log/staging/分支/冲突矩阵；与 git CLI 结果对比 | `tempfile` + 真实 git |
| 前端单元 | 状态管理、格式化、diff 解析 | Vitest |
| 前端组件 | 变更列表、diff 视图、提交表单 | Testing Library |
| E2E | 打开仓库 → 暂存 → 提交 → 切分支 → 查看历史 | Playwright + IPC mock / tauri-driver |
| 静态检查 | `cargo clippy -D warnings`、`eslint`、`tsc --noEmit` | CI |

兼容性矩阵：Ubuntu LTS、Fedora、Arch；X11 与 Wayland 各跑一遍核心 E2E。

## 12. 打包与分发

- 产物：`.deb`（主推）与 `.AppImage`（便携）；Flatpak 作为后续补充。
- 依赖：`webkit2gtk-4.1`、系统 git ≥ 2.30；缺失时安装包声明依赖或启动时提示。
- 桌面集成：图标、`.desktop`、文件管理器右键「用 GitEasy 打开」。
- 自动更新：Tauri updater + 签名校验，可关闭。
- CI：GitHub Actions（ubuntu-latest）执行 lint、test、打包并产出构建产物。

## 13. 里程碑

| 阶段 | 交付 | 验收 |
|---|---|---|
| M0 骨架 | Tauri 工程、设计 token、三栏布局、IPC 类型链、设置存储 | 打开仓库并显示占位数据 |
| M1 只读 | 变更列表、diff 查看器、历史图谱、提交详情、文件历史入口 | 真实仓库 1s 内出首屏 |
| M2 写入闭环 | 行级暂存、提交/amend、分支、fetch/pull/push 与进度、认证 | 日常开发可完全脱离命令行 |
| M3 进阶 | 冲突解决器、stash、tag、cherry-pick/revert/reset、blame | 合并冲突可纯 GUI 解决 |
| M4 打磨发布 | submodule、LFS 提示、worktree、命令面板、双主题、deb/AppImage、更新 | 安装即用，操作无卡顿 |
| 后续 | 交互式 rebase 可视化编排（独立设计文档） | 单独验收 |

## 14. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| libgit2 与 git CLI 行为差异（ignore 规则、换行转换） | status/diff 与命令行不一致 | 集成测试与 CLI 结果对比；关键路径以 CLI 为准 |
| Linux WebKitGTK 渲染差异 | 不同发行版 UI 表现不一致 | CI 矩阵 + 启动自检；避免使用激进 CSS 特性 |
| 超大仓库性能 | 历史与 blame 卡顿 | 分页、虚拟滚动、上限保护、浅克隆建议 |
| hooks 依赖环境变量 | 提交失败或行为异常 | 通过 CLI 提交并继承用户 shell 环境；原样回显输出 |
| 冲突解决器复杂度 | 延期风险 | M3 单独立项，先覆盖 merge/rebase 两类主流场景 |

## 15. 已确认决策与待办

已确认：

- 技术栈：Tauri 2 + React 19 + TypeScript。
- 视觉方向：浅色清爽风为主，深色主题可选。
- 产品范围：完整功能客户端，不含 PR/CI 集成。
- Git 后端：libgit2 读 + git CLI 写 的混合方案。
- 交互式 rebase：不进入 M0–M4，M4 之后单独立项。

待办：

- 进入实现计划阶段，按 M0 → M1 拆解任务与验收用例。

## 16. 实现记录（2026-10-31）

已完成并验证：

- M0 工程骨架：Tauri 2 + React 19 + TypeScript + Vite + Tailwind 4，设计 token 与三栏布局。
- M1 只读链路：仓库打开/发现/初始化、变更列表、统一/分栏 diff、历史图谱、提交详情、文件历史、Blame。
- M2 写操作：文件/hunk/行级暂存与取消暂存、提交/amend/signoff、分支增删改查切换、merge、fetch/pull/push 流式进度、系统 git 认证。
- M3 进阶：冲突三栏解决器、stash 预览与应用/弹出、tag、cherry-pick/revert/reset、子模块更新、worktree 管理。
- M4 打磨：浅色/深色双主题、命令面板与快捷键、设置中心（外观/编辑器/终端/提交身份）、文件监听自动刷新、`.deb` 打包。
- 交互打磨：分支双击切换、侧边栏宽度可拖拽并记忆、Toast 10 秒自动消失、Conventional Commit 辅助、按作者/路径过滤历史、diff 忽略空白、一键在外部编辑器打开。
- 交互式变基：`rebase_todo` 读取 `base..HEAD` 提交，前端可调整顺序并选择 pick/reword/squash/fixup/drop，后端通过 `GIT_SEQUENCE_EDITOR` 注入 todo 执行 `git rebase -i`；冲突时切换到冲突视图继续。
- 冲突解决增强：支持显示 base（共同祖先）版本，解析冲突标记并按块采用我的/对方/两者保留，支持批量采用。
- 新增文件按行暂存：未跟踪文件可通过生成带 `new file mode` 的补丁执行 `git apply --cached`，仅暂存选中行。
- 后端集成测试通过（status/stage/commit/log/branch、整块暂存）；前端 `tsc` 与 Vite 构建通过。
- 构建辅助：`scripts/build.sh` 在缺少 GTK 开发软链的精简环境中自动生成链接垫片；`npm run build:app` / `npm run test:backend` 已封装该逻辑。

环境限制与说明：

- AppImage 打包需要从 GitHub 下载 AppRun，本次环境网络不可达，因此仅产出 `.deb`；`src-tauri/tauri.conf.json` 的 targets 暂设为 `deb`，网络恢复后可改回 `["deb", "appimage"]` 重新打包。
- 交互式 rebase 已完成基础版本（动作编排、排序、reword、冲突续作）；更细的逐提交 diff 预览与拖拽排序留待后续增强。
- Git LFS 由系统 git 透传处理，暂未提供独立状态面板。
- 前端包含仅开发模式启用的 IPC Mock（`src/lib/mock.ts`），用于浏览器内预览界面，生产构建不会启用。
