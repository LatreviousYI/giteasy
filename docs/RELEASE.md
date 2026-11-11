# GitEasy 发布检查

## 支持环境

- Ubuntu LTS / Fedora / Arch Linux
- macOS 11+，Apple Silicon（arm64）
- X11 与 Wayland
- WebKitGTK 4.1
- Git 2.30+
- 可选：Git LFS、GPG、系统 Secret Service

## 发布前命令

```bash
npm ci
npm run test:frontend
npm run test:backend
npm run build
npm run test:e2e
npm run build:app
```

Apple Silicon DMG：

```bash
npm run build:macos-arm64
```

macOS CI：`.github/workflows/build-macos-arm64.yml`，产出 arm64 `.app` 和 `.dmg`。

## 安装包

产物位于：

```text
src-tauri/target/release/bundle/deb/
```

macOS：

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/GitEasy.app
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/GitEasy_0.1.0_aarch64.dmg
```

安装：

```bash
sudo dpkg -i GitEasy_0.1.0_amd64.deb
sudo apt-get install -f
```

## 手动验收

1. 启动应用并打开真实仓库。
2. 切换两个仓库 Tab，重启后确认工作区恢复。
3. 暂存、取消暂存、提交和查看 hooks 输出。
4. 比较分支与工作区，打开 Reflog 并恢复测试仓库。
5. 创建 Worktree 和 Submodule 操作。
6. GitHub 登录、克隆、通知、PR/Issue 和创建 PR。
7. 检查 LFS、Patch、图片 diff、Bisect 和自定义命令。
8. 在 1080/1280/1440 及深色主题下检查无文字重叠或不可用布局。

## 已知环境要求

- 无系统 Secret Service 时 GitHub Keyring 登录会失败，但本地 Git 功能不受影响。
- GitHub Device Flow 需要配置 GitEasy 自己的 OAuth App Client ID。
- 图片 diff 支持 PNG、JPEG、GIF、WebP、SVG、BMP 和 ICO。
