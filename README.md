# GitEasy

GitEasy 是一个 **Linux 优先** 的原生 Git GUI，同时支持 macOS Apple Silicon；目标是覆盖 Fork 的核心工作流，并提供 GitHub 集成。

## 技术栈

- Tauri 2
- Rust + libgit2 + system git
- React 19 + TypeScript + Vite
- TanStack Query + Zustand

## 功能

- 多仓库 Tab、工作区恢复、命令面板和 Activity Manager
- 文件树、行级暂存、提交、amend、hooks 输出
- 历史图谱、Ref/工作区比较、提交文件树、Blame、Reflog
- 冲突解决、交互式 Rebase、Worktree、Submodule
- GitHub Device Flow / PAT、仓库克隆、通知、PR/Issue 和创建 PR
- Patch、图片 diff、LFS、GPG、自定义命令和外部工具
- Bisect、Repository Manager 和仓库统计
- AppImage 与 macOS 客户端内更新

## 平台方向

- Linux 是主要开发和发布平台，优先保证 Ubuntu/Debian、X11/Wayland 和 AppImage 客户端内更新体验。
- Linux 主要发布 `.AppImage` 与 `.deb`；AppImage 是自动更新推荐渠道。
- macOS Apple Silicon 是次要支持平台，发布 `.dmg` 和 updater 包。
- Windows 尚未完成平台适配，不提供正式安装包。

## 开发

修改代码前请先阅读 [AGENTS.md](AGENTS.md) 中的架构、复用、测试和发布约束。

```bash
npm install
npm run dev
```

浏览器预览使用内置 Mock；Tauri 桌面版使用真实 Git 仓库。

## 验证

```bash
npm run test:frontend
npm run test:backend
npm run build
npm run test:e2e
```

E2E 使用系统 Firefox + geckodriver，并生成 `docs/visual-baselines/` 截图。

## 打包

```bash
npm run build:app
```

当前 Linux 安装包目标为 `.deb`，依赖系统 `git`、WebKitGTK 4.1 和系统 Git 凭据环境。

Apple Silicon（M1/M2/M3/M4）macOS 安装包必须在 macOS/Xcode 环境构建：

```bash
npm run build:macos-arm64
```

macOS `.app`、`.dmg` 和 updater 包由 `Publish GitHub Release` 工作流统一构建。

Windows 目前尚未完成 Keyring、Shell、终端和文件打开适配，因此暂不发布 Windows 安装包。

完整的 Linux、macOS 和 Windows 打包状态、依赖、命令与产物路径见 [docs/PACKAGING.md](docs/PACKAGING.md)。

合并到 `master` 后，发布工作流会基于最新标签自动递增 patch 版本并创建 Release。默认例如 `v0.1.3 → v0.1.4`；PR 标题包含 `[minor]` 或 `[major]` 时分别提升次版本或主版本。各系统应下载的包见 [docs/DOWNLOADS.md](docs/DOWNLOADS.md)。

客户端内更新的密钥配置、发布资产和平台行为见 [docs/UPDATES.md](docs/UPDATES.md)。

## 版本发布规则

GitEasy 使用语义化版本：

| PR 标题标记 | 版本变化 | 示例              |
| ----------- | -------- | ----------------- |
| 无标记      | patch    | `v0.1.5 → v0.1.6` |
| `[minor]`   | minor    | `v0.1.5 → v0.2.0` |
| `[major]`   | major    | `v0.1.5 → v1.0.0` |

标记出现在 PR 标题中的任意位置都会生效，并且不区分大小写。例如 `Dev[minor]` 会发布次版本 `v0.2.0`。普通功能和修复请不要添加 `[minor]` 或 `[major]`。

版本由 CI 自动生成，不需要手工修改版本文件或创建标签。Release 发布后不建议删除标签并降级版本，因为已经安装新版本的客户端不会把较低版本识别为更新。

完整发布流程见 [docs/RELEASE.md](docs/RELEASE.md)。

## 同类工具参考

[Fork](https://git-fork.com/) 是成熟的商业 Git 客户端，GitEasy 将 Fork 作为交互方式和核心 Git 工作流的参考之一。

Fork 与 GitEasy 没有官方关联。Fork 支持的平台和授权方式以其官网为准；GitEasy 的开发重心仍然是 Linux。

## 凭据与隐私

- GitHub Token 存储在系统 Keyring。
- Git 认证交给 credential helper、SSH agent 和系统 Git。
- ActivityLog 对 URL 内嵌凭据进行脱敏。
