# GitEasy 客户端内更新

## 工作方式

GitEasy 使用 Tauri updater：

1. 应用通过 GitHub Release 下载对应的平台更新清单。
2. 清单提供新版本、更新说明、更新包 URL 和 minisign 签名。
3. 客户端验证签名后才下载和安装。
4. AppImage 和 macOS 支持应用内安装并自动重启。

更新清单地址：

```text
https://github.com/LatreviousYI/giteasy/releases/latest/download/updater-linux-x86_64.json
https://github.com/LatreviousYI/giteasy/releases/latest/download/updater-darwin-aarch64.json
```

Tauri 配置使用模板：

```text
updater-{{target}}-{{arch}}.json
```

## 首次升级

`0.1.0` 不包含 updater 插件，因此不能自动升级到 `0.1.1`。

升级顺序：

```text
0.1.0 手动安装 0.1.1
0.1.1 应用内升级到 0.1.2
```

## GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions` 添加：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

本机生成的文件：

```text
~/.tauri/giteasy-updater.key
~/.tauri/giteasy-updater.key.pub
~/.tauri/giteasy-updater.key.password
```

`TAURI_SIGNING_PRIVATE_KEY` 必须填写私钥文件内容，不是文件路径。密码填写密码文件内容。

私钥丢失或密码丢失后，已安装客户端无法继续校验新更新。私钥不要提交到仓库、聊天或普通备份目录。

## 平台策略

| 安装形式 | 客户端行为 |
| --- | --- |
| AppImage | 下载、校验、替换当前 AppImage 并重启 |
| macOS `.app` | 下载 `.app.tar.gz`、校验、安装并重启 |
| `.deb` | 显示更新并打开 Release 下载页，不静默提权安装 |
| 便携版二进制 | 显示更新并打开 Release 下载页 |

如果希望 Linux 用户全部使用客户端内升级，推荐发布 AppImage 作为主要升级渠道。

## 发布资产

Ubuntu：

```text
GitEasy_0.1.1_amd64.AppImage
GitEasy_0.1.1_amd64.AppImage.sig
updater-linux-x86_64.json
GitEasy_0.1.1_amd64.deb
```

macOS Apple Silicon：

```text
GitEasy.app.tar.gz
GitEasy.app.tar.gz.sig
updater-darwin-aarch64.json
GitEasy_0.1.1_aarch64.dmg
```

## 签名边界

Tauri minisign 签名只验证更新包来源和完整性，不等同于 Apple Developer 签名。

macOS 正式分发仍需要 Developer ID 签名和公证，否则 Gatekeeper 可能阻止应用首次安装或升级。
