# GitEasy 多平台打包指南

本文说明 GitEasy 在 Linux、macOS 与 Windows 上的构建状态、依赖、命令和产物路径。发布前统一先完成 `docs/RELEASE.md` 中的验收检查。

## 平台状态

| 平台 | 当前状态 | 安装包 |
| --- | --- | --- |
| Linux x86_64 | 支持 | `.deb`，可选 AppImage / RPM |
| macOS Apple Silicon | 支持 | `.app`、`.dmg` |
| macOS Intel / Universal | 未配置 | 需要新增目标与 CI |
| Windows x86_64 | 尚未发布 | 需先完成平台适配，不应发布安装包 |

## 通用环境

- Node.js 22
- npm 10+
- Rust stable
- 系统 Git 2.30+
- 各平台对应的 Tauri 2 系统依赖

安装依赖并验证：

```bash
npm ci
npm run test:frontend
npm run test:backend
npm run build
```

统一发布检查：

```bash
npm run test:e2e
```

## Linux

### Debian / Ubuntu

```bash
sudo apt update
sudo apt install -y \
  build-essential curl file libssl-dev \
  libwebkit2gtk-4.1-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf
```

### Fedora

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel libappindicator-gtk3-devel \
  librsvg2-devel openssl-devel patchelf
```

### Arch Linux

```bash
sudo pacman -S --needed \
  webkit2gtk-4.1 libappindicator-gtk3 librsvg openssl patchelf
```

### 构建

当前默认 `.deb`：

```bash
npm run build:app
```

产物：

```text
src-tauri/target/release/bundle/deb/
```

额外构建 AppImage 或 RPM：

```bash
npm run tauri -- build --bundles appimage
npm run tauri -- build --bundles rpm
```

产物分别位于：

```text
src-tauri/target/release/bundle/appimage/
src-tauri/target/release/bundle/rpm/
```

注意事项：

- Linux 构建必须使用 WebKitGTK 4.1，不要混用 4.0。
- 安装包依赖系统 `git`，不会内置 Git。
- GitHub 登录依赖系统 Secret Service；无可用密钥环时本地 Git 功能仍可使用。
- `.deb` 安装命令：`sudo apt install ./GitEasy_0.1.0_amd64.deb`。

## macOS

仅支持在 macOS + Xcode Command Line Tools 环境中构建，不能从 Linux 交叉生成可运行的 `.app` 或 `.dmg`。

### Apple Silicon

```bash
xcode-select --install
npm ci
npm run build:macos-arm64
```

产物：

```text
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/GitEasy.app
src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/GitEasy_0.1.0_aarch64.dmg
```

CI：

```text
.github/workflows/build-macos-arm64.yml
```

标签 `v*` 或手动触发后上传 `.app` 和 `.dmg`。

### 签名与公证

CI 已预留以下 Secret：

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY
APPLE_ID
APPLE_PASSWORD
APPLE_TEAM_ID
```

没有签名证书时可以生成开发包，但 Gatekeeper 会提示未验证。正式发布必须完成 Developer ID 签名和公证。

### 尚未配置

- Intel `x86_64-apple-darwin`
- Universal Binary

需要分别增加 Rust target、Tauri 构建命令和 CI 矩阵。

## Windows

当前代码尚未完成 Windows 平台适配，因此不能把 Windows 安装包列为可发布产物。

### 当前阻塞项

- `keyring` 只配置了 Linux 和 macOS target，Windows 需要启用 `windows-native`。
- 自定义命令和外部工具仍使用 `bash -lc`，需要增加 `cmd.exe` 或 PowerShell 分支。
- 默认打开路径仍使用 `xdg-open` / macOS `open`，需要增加 Windows `start` 实现。
- 默认终端仍面向 Linux/macOS，需要识别 Windows Terminal / `cmd.exe`。
- 需要 `.ico` 图标和 Windows CI 验证。

### 适配完成后的目标命令

NSIS：

```powershell
npm ci
npm run test:frontend
npm run test:backend
npm run build
npm run tauri -- build --bundles nsis
```

MSI：

```powershell
npm run tauri -- build --bundles msi
```

预计产物：

```text
src-tauri/target/release/bundle/nsis/
src-tauri/target/release/bundle/msi/
```

MSI 构建依赖 WiX。Windows 发布前必须新增 `windows-latest` CI，并确认应用可使用系统 Git、终端、凭据管理和文件打开功能。

## 发布产物命名

建议统一附加平台与架构：

```text
GitEasy_0.1.0_amd64.deb
GitEasy_0.1.0_amd64.AppImage
GitEasy_0.1.0_aarch64.dmg
GitEasy_0.1.0_x64-setup.exe
GitEasy_0.1.0_x64_en-US.msi
```

正式发布同时生成 `SHA256SUMS`，并对 macOS 安装包完成签名和公证。
