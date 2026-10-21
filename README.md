# Komari Notification Plugins

[简体中文](#简体中文) | [English](#english)

## 简体中文

一组为 Komari 提供通知渠道的独立插件。本仓库中的插件从 Komari 内置通知渠道迁移而来，统一对外提供可热插拔的通知能力。

> **维护状态**
>
> 本仓库目前暂无持续维护计划。作者会处理影响插件基本可用性的严重问题，但不承诺功能更新、渠道扩展或长期兼容性支持。
>
> 如果社区存在功能更完整、维护更活跃的同类插件，欢迎前往 [Komari Plugin Market](https://github.com/komari-monitor/plugin-market/issues/new/choose) 提交替换申请，将市场中对应的条目替换为更合适的实现。提交时请选择对应的插件提交模板，并说明被替换插件及替换原因。

### 插件列表

| 插件 | 渠道 ID | 说明 |
| --- | --- | --- |
| `bark-notification-plugin` | `bark` | 通过 Bark 推送通知 |
| `email-notification-plugin` | `email` | 通过 SMTP 发送邮件通知 |
| `serverchan3-notification-plugin` | `Server酱³` | 通过 Server酱³ 推送通知 |
| `serverchanturbo-notification-plugin` | `Server酱Turbo` | 通过 Server酱 Turbo 推送通知 |
| `telegram-notification-plugin` | `telegram` | 通过 Telegram Bot 推送通知 |

### 环境要求

- Komari `>= 1.6.0`
- 插件运行环境需启用 Komari 插件的通知渠道注册 API
- 邮件插件需要启用插件 `node` 权限；其他插件只使用运行时提供的 `fetch` 能力

### 安装

1. 从 [Releases](https://github.com/Akizon77/komari-notification-plugins/releases) 下载需要的插件 ZIP。
2. 在 Komari 后台的插件管理页面上传 ZIP。
3. 启用插件。
4. 在通知设置中选择对应渠道并填写配置。

每个 ZIP 的根目录均包含 `komari-plugin.json`、`script.js` 和 `icon.webp`，可直接由 Komari 插件安装器读取。

### 邮件加密设置

- 使用 587 等 STARTTLS 端口时，可以保持“启用 SSL”关闭；插件会在服务器声明支持 STARTTLS 时自动升级到 TLS，然后进行认证和发送邮件。
- 开启“启用 SSL”时，465 端口使用隐式 TLS，其他端口强制使用 STARTTLS。
- STARTTLS 被拒绝或 TLS 握手失败时，发送会报错，不会回退到明文认证。关闭“启用 SSL”且服务器未声明支持 STARTTLS 时，保留原有明文 SMTP 行为。

### 从源码构建

需要 Node.js 18 或更高版本：

```bash
npm ci
npm test
npm run build
```

构建产物位于 `dist/`。脚本只负责校验源码并将每个插件目录打包为 ZIP，不会执行插件代码。

### 配置迁移说明

插件保留了原有通知渠道 ID 和配置字段名，因此旧版本保存的同名渠道配置可以继续读取。实际可用性取决于目标 Komari 版本是否提供了对应的插件通知渠道 API。

### 许可证

本仓库以 [MIT License](./LICENSE) 发布。部分实现源自 Komari 项目的内置通知渠道；第三方品牌图标仍归各自权利人所有。

## English

A collection of standalone notification channel plugins for Komari. These plugins were migrated from Komari's built-in notification channels and are distributed as hot-installable plugin packages.

> **Maintenance status**
>
> This repository currently has no ongoing maintenance plan. The author may address critical issues that affect basic usability, but does not commit to feature updates, new channels, or long-term compatibility support.
>
> If a better maintained community implementation becomes available, please open an issue in the [Komari Plugin Market](https://github.com/komari-monitor/plugin-market/issues/new/choose) to request that the corresponding catalog entry be replaced. Use the plugin submission issue form and identify the plugin being replaced and the reason for the replacement.

### Plugins

| Plugin | Channel ID | Description |
| --- | --- | --- |
| `bark-notification-plugin` | `bark` | Send notifications through Bark |
| `email-notification-plugin` | `email` | Send email notifications through SMTP |
| `serverchan3-notification-plugin` | `Server酱³` | Send notifications through ServerChan3 |
| `serverchanturbo-notification-plugin` | `Server酱Turbo` | Send notifications through ServerChan Turbo |
| `telegram-notification-plugin` | `telegram` | Send notifications through a Telegram bot |

### Requirements

- Komari `>= 1.6.0`
- A Komari build that exposes the plugin notification channel registration API
- The email plugin requires the plugin `node` permission; the other plugins use only the runtime-provided `fetch` API

### Installation

1. Download the required plugin ZIP from [Releases](https://github.com/Akizon77/komari-notification-plugins/releases).
2. Upload the ZIP from the Komari admin plugin page.
3. Enable the plugin.
4. Select the notification channel in the notification settings and fill in its configuration.

Each ZIP contains `komari-plugin.json`, `script.js`, and `icon.webp` at its root and can be installed directly by Komari.

### Email Transport Security

- For STARTTLS ports such as 587, "Enable SSL" can remain off. The plugin automatically upgrades to TLS when the server advertises STARTTLS, before authenticating or sending mail.
- With "Enable SSL" on, port 465 uses implicit TLS and other ports require STARTTLS.
- A rejected STARTTLS command or failed TLS handshake fails delivery without falling back to plaintext authentication. With "Enable SSL" off and no advertised STARTTLS support, the existing plaintext SMTP behavior is preserved.

### Build from Source

Node.js 18 or newer is required:

```bash
npm ci
npm test
npm run build
```

The generated packages are written to `dist/`. The build only validates and packages the plugin sources; it does not execute plugin code.

### Configuration Compatibility

The plugins keep the original notification channel IDs and configuration field names, so configuration saved under the same channel can continue to be read. Availability depends on whether the target Komari version provides the plugin notification channel API.

### License

This repository is released under the [MIT License](./LICENSE). Parts of the implementation originate from Komari's built-in notification channels; third-party brand icons remain the property of their respective owners.
