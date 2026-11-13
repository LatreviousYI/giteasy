# GitEasy

GitEasy 是一个面向 Linux 和 macOS 的原生 Git GUI，目标是覆盖 Fork 的核心工作流，并提供 GitHub 集成。

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

## 开发

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

也可以通过 GitHub Actions 的 `Build macOS Apple Silicon` 工作流构建 `.app` 和 `.dmg`。

Windows 目前尚未完成 Keyring、Shell、终端和文件打开适配，因此暂不发布 Windows 安装包。

完整的 Linux、macOS 和 Windows 打包状态、依赖、命令与产物路径见 [docs/PACKAGING.md](docs/PACKAGING.md)。

版本标签会同时触发 Ubuntu 和 macOS Apple Silicon 构建，并将安装包发布到 [GitHub Releases](https://github.com/LatreviousYI/giteasy/releases)。各系统应下载的包见 [docs/DOWNLOADS.md](docs/DOWNLOADS.md)。

## 凭据与隐私

- GitHub Token 存储在系统 Keyring。
- Git 认证交给 credential helper、SSH agent 和系统 Git。
- ActivityLog 对 URL 内嵌凭据进行脱敏。





