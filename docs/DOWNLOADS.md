# GitEasy Downloads

请根据操作系统和 CPU 架构选择安装包。

| 系统 | 架构 | 推荐下载 | 备用 |
| --- | --- | --- | --- |
| Ubuntu 24.04+ / Debian | x86_64 | `.AppImage`（支持客户端内更新） | `.deb` |
| macOS 11+ | Apple Silicon（M1/M2/M3/M4） | `.dmg` | `.app` 构建 artifact |
| Windows | x86_64 | 暂未支持 | 无 |

## Ubuntu / Debian

需要系统菜单集成时下载 `.deb`：

```bash
sudo apt install ./GitEasy_*.deb
```

如果希望免安装运行并支持客户端内更新，推荐下载 `.AppImage`：

```bash
chmod +x GitEasy_*.AppImage
./GitEasy_*.AppImage
```

系统需要 Git、WebKitGTK 4.1 和可用的桌面环境。

## macOS Apple Silicon

下载 `.dmg`，打开后将 GitEasy 拖入 Applications。

- 支持 M1、M2、M3、M4。
- 最低 macOS 11。
- 未签名构建可能触发 Gatekeeper，需要在 Finder 中右键应用并选择“打开”，或在系统设置的“隐私与安全性”中允许。
- Intel Mac 和 Universal Binary 暂未提供。

## Windows

Windows 版本尚未完成 Keyring、Shell、终端和文件打开适配，因此当前 Release 不提供 Windows 安装包。

## 最新版本

[打开 GitEasy Releases](https://github.com/LatreviousYI/giteasy/releases/latest)

