# Kuromusic 🎵

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-38-47848F)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D)](https://vuejs.org/)

基于 **Electron + Vue 3** 的开源桌面音乐播放器。支持网易云音乐搜索/播放、歌词展示、本地音乐导入、歌单管理、下载管理，并内置迷你播放器、系统托盘、全局快捷键、桌面通知与自动更新等桌面能力。

> 本项目仅供学习研究使用，请勿用于商业用途。详见文末「免责声明」。

## 功能特性

- 网易云搜索：按关键词检索歌曲、歌单等资源
- 歌曲播放：多音质播放（标准 → Hi-Res），播放失败自动降级重试
- 歌词：歌词/译文展示与自动滚动
- 歌单：热门/精品歌单、歌单详情、本地歌单增删改、收藏歌单
- 本地音乐：选择本地音频文件并解析标题、歌手、专辑、时长、封面
- 登录：二维码、手机号密码/验证码登录，登录态持久化
- 个性化推荐：每日推荐歌单/歌曲、私人 FM
- 喜欢音乐：喜欢/取消喜欢，喜欢列表
- 下载管理：下载目录选择、歌曲下载、下载记录持久化
- 播放队列：下一首播放、批量选择移除
- 迷你播放器：380×88 常驻小窗，可托盘/快捷键切换
- 系统托盘：播放控制菜单、关闭时最小化到托盘
- 全局快捷键：播放/暂停、上一首/下一首、迷你模式，可在设置中录制自定义
- 媒体键与通知：系统媒体控制（MediaSession）、切歌系统通知
- 自动更新：基于 GitHub Releases 的检查/下载/一键安装

## 技术栈

- Electron 38
- Vue 3 + Vite（electron-vite）
- Pinia
- Vue Router（Memory History）
- Naive UI
- @neteasecloudmusicapienhanced/api
- electron-store（本地持久化）
- music-metadata（本地音频元数据读取）

## 快速开始

### 环境要求

- Node.js 18+
- pnpm 8+
- Windows / macOS / Linux

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

说明：Windows 下开发脚本会先执行 `chcp 65001`，避免终端中文乱码。

### 代码质量

```bash
pnpm lint      # ESLint
pnpm format    # Prettier
pnpm test      # Vitest 单元测试
```

## AI 功能（可选）

- 提供 AI 歌单推荐与对话能力，基于 OpenAI 兼容接口，默认阿里云 DashScope。
- 配置入口：设置 → AI Provider，填写 API Key / 模型 / Base URL（默认 `qwen-plus`）。
- API Key 仅保存在本机用户数据目录，不会上传到第三方。
- 未配置或接口不可用时，不影响核心播放功能。

## 设置项说明

- 播放设置：自动播放下一首、淡入淡出、显示歌词、音质选择
- 全局快捷键：默认 `Ctrl+Alt+Space` 播放/暂停、`Ctrl+Alt+←/→` 上下曲、`Ctrl+Alt+M` 迷你模式，点击行即可录制自定义
- 桌面设置：开机自启、关闭时最小化到托盘
- 软件更新：自动检查开关、手动检查、立即重启安装

## 打包发布

```bash
# 仅构建源码（out 目录）
pnpm build

# 生成可安装包
pnpm build:win
pnpm build:mac
pnpm build:linux

# 生成未打包目录（调试安装内容）
pnpm build:unpack
```

打包配置见 `electron-builder.yml`，当前产品名为 `KuroMusic`。

### 自动更新与发布

- 自动更新基于 [electron-updater](https://www.electronjs.org/docs/latest/tutorial/updates)，发布源为 GitHub Releases（配置在 `electron-builder.yml` 的 `publish` 段）。
- 应用启动 60 秒后静默检查更新；也可在「设置 → 软件更新」手动检查/立即重启安装。
- 发布流程：推送形如 `v1.2.0` 的 tag 到 GitHub，`.github/workflows/release.yml` 会自动构建 Windows / macOS / Linux 安装包并上传 Release。
- 开发模式调试更新：根目录 `dev-app-update.yml` 已指向同一发布源，`pnpm dev` 中可在设置页手动触发检查（启动时不会自动检查）。

## 项目结构

```text
.
|-- electron-builder.yml
|-- electron.vite.config.mjs
|-- src
|   |-- main
|   |   |-- index.js                     # 主进程：窗口 + IPC + 系统能力
|   |   |-- auth/login.js                # 登录与 cookie 持久化
|   |   |-- ai/                          # AI 推荐 / RAG 服务
|   |   `-- getLocalConfig/              # 歌单与 AI 配置持久化
|   |-- preload
|   |   `-- index.js                     # 暴露 window.api 给渲染进程
|   `-- renderer
|       |-- index.html
|       `-- src
|           |-- stores                   # Pinia 状态（播放/歌单/用户等）
|           |-- components               # 布局与内容组件
|           |-- services                 # 业务服务（播放降级、快捷键等）
|           |-- utils                    # 工具函数
|           `-- views                    # 页面
`-- resources
```

## 架构说明

### 进程分层

- Main 进程（`src/main`）：创建窗口、系统能力（托盘/快捷键/自启/更新）、网易云 API、下载、本地数据读写
- Preload 进程（`src/preload`）：通过 `contextBridge` 暴露受控 API（`window.api`）
- Renderer 进程（`src/renderer`）：Vue 页面与组件，仅通过 `window.api` 完成功能

### IPC 通信

- 渲染进程通过 `window.api.xxx()` 调用业务能力
- 主进程通过 `ipcMain.handle` / `ipcMain.on` 统一处理
- 下载记录、歌单、AI 配置写入系统用户数据目录（`app.getPath('userData')`）

## 关键模块

- 登录模块：`src/main/auth/login.js` — 使用 electron-store 持久化 cookie，重启后可恢复登录态
- 本地歌单：`src/main/getLocalConfig/playlistconfig.js` — 创建/收藏歌单、歌曲增删、封面同步
- 下载模块：`src/main/index.js` + `src/renderer/src/utils/downloadUtils.js` — 下载地址、保存文件、下载历史
- 播放引擎：`src/renderer/src/stores/songStore.js` — 播放队列、随机/列表/单曲循环、下一首播放
- 音质降级：`src/renderer/src/services/player/playbackFailover.js` — 播放失败自动切换低音质
- 全局快捷键：`src/renderer/src/services/player/globalShortcuts.js` + `src/main/index.js` — 自定义录制与主进程注册
- 桌面设置：`src/renderer/src/services/desktopSettings.js` — 开机自启、托盘偏好、自动更新偏好

## 开发建议

- 推荐 IDE：VS Code + ESLint + Prettier + Volar
- 组件样式以 scss 为主，按模块维护（layout/content 分层）
- 新增 IPC 时同步更新：Main（`ipcMain.handle`）→ Preload（`window.api`）→ Renderer 调用
- 提交前运行 `pnpm lint` 与 `pnpm test`；详见 [CONTRIBUTING.md](CONTRIBUTING.md)

## 隐私说明

- 设置、歌单、下载记录与登录 cookie 均保存在本机用户数据目录。
- AI API Key 仅存本机，不随应用发送给第三方。
- 应用会向网易云接口发起音乐相关请求；使用 AI 功能时会将相关上下文发送给你配置的 AI 服务商。

## 免责声明

- 本项目通过非官方接口使用网易云音乐服务，接口可用性受网络与上游变更影响，不保证持续可用。
- 所有音乐版权归版权方所有，本项目仅供学习研究，请勿用于商业用途。
- 使用本项目产生的任何版权、法律风险由使用者自行承担。

## 常见问题（FAQ）

- **播放失败/没声音？** 应用会自动降级音质重试；可在设置中降低音质。
- **媒体键不生效？** 媒体键走系统媒体控件（Windows 媒体浮窗），Linux MPRIS 支持有限。
- **开机自启无效？** 确认系统启动项中是否被安全软件禁用。
- **更新检查失败？** 自动更新仅对安装版（非源码运行）生效；开发模式可在设置页手动触发检查。
- **全局快捷键被占用？** 其他应用占用时会注册失败，设置页会提示，可换一组快捷键。

## 贡献

欢迎提交 Issue 与 PR！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解开发与提交规范。

## 致谢

- [@neteasecloudmusicapienhanced/api](https://www.npmjs.com/package/@neteasecloudmusicapienhanced/api)
- [electron-vite](https://electron-vite.org/)、[Electron](https://www.electronjs.org/)、[Vue 3](https://vuejs.org/)、[Naive UI](https://www.naiveui.com/)

## License

本项目基于 [MIT License](LICENSE) 开源。
