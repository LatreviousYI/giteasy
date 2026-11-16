# GitEasy 发布检查

完整的多平台依赖、构建命令和产物路径见 [PACKAGING.md](PACKAGING.md)。

## 发布平台状态

- Linux x86_64：`.deb` 默认发布目标。
- macOS Apple Silicon：`.app` 与 `.dmg`。
- Windows：尚未完成平台适配，不发布。

合并到 `master` 后，`Publish GitHub Release` 会自动生成版本：

1. 查找当前最新 `vX.Y.Z` 标签。
2. 默认递增 patch，例如 `v0.1.3 → v0.1.4`。
3. 将计算出的版本应用到构建工作区中的 `package.json`、锁文件、Cargo 配置和 Tauri 配置。
4. 并行构建 Ubuntu 和 macOS 产物。
5. 下载两端 artifact，确认 `.deb`、`.AppImage`、`.dmg` 和 updater 清单齐全。
6. 统一创建 GitHub Release 并设置为 `latest`。

不需要在功能 PR 中手工修改版本，也不需要推送标签。默认发布 patch：

```text
普通合并       -> patch
PR 标题含 [minor] -> minor
PR 标题含 [major] -> major
```

同一提交重跑发布时会复用已经创建的标签，不会重复递增版本。

发布必须配置 `TAURI_SIGNING_PRIVATE_KEY` 与 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，具体流程见 [UPDATES.md](UPDATES.md)。

## 通用验收命令

```bash
npm ci
npm run test:all
```

单独执行：

```bash
npm run test:frontend
npm run test:backend
npm run build
npm run test:e2e
```

## Linux 发布

```bash
npm run build:app
```

默认产物：

```text
src-tauri/target/release/bundle/deb/
```

可选 AppImage / RPM：

```bash
npm run tauri -- build --bundles appimage
npm run tauri -- build --bundles rpm
```

## macOS 发布

Apple Silicon：

```bash
npm run build:macos-arm64
```

CI：

```text
.github/workflows/build-macos-arm64.yml
```

正式发布必须配置 Developer ID 签名和公证 Secret，具体变量见 [PACKAGING.md](PACKAGING.md)。

## Ubuntu 发布

CI：

```text
.github/workflows/build-linux-ubuntu.yml
```

产物：

```text
src-tauri/target/release/bundle/deb/*.deb
src-tauri/target/release/bundle/appimage/*.AppImage
```

## Windows 发布

Windows 当前不可发布。应先完成 Keyring、Shell、终端、文件打开、`.ico` 图标和 `windows-latest` CI 适配，再启用 NSIS/MSI 打包。

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
- Linux 安装包依赖系统 Git、WebKitGTK 4.1 和系统凭据环境。
