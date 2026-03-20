# Kuromusic

基于 Electron + Vue 3 的桌面音乐播放器，支持网易云歌曲搜索/播放、歌词展示、本地音乐导入、本地/收藏歌单管理、下载与登录态持久化。

## 技术栈

- Electron 38
- Vue 3 + Vite（electron-vite）
- Pinia
- Vue Router（Memory History）
- Arco Design Vue
- @neteasecloudmusicapienhanced/api
- electron-store（本地持久化）
- music-metadata（本地音频元数据读取）

## 快速开始

### 1. 环境要求

- Node.js 18+
- pnpm 8+
- Windows / macOS / Linux

### 2. 安装依赖

```bash
pnpm install
```

### 3. 本地开发

```bash
pnpm dev
```

说明：Windows 下开发脚本会先执行 `chcp 65001`，避免终端中文乱码。

### 4. 代码质量

```bash
pnpm lint
pnpm format
```

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

## 核心功能

- 网易云搜索：按关键词检索歌曲等资源
- 歌曲播放：获取播放 URL，支持歌词/译文展示与自动滚动
- 歌单能力：热门/精品歌单、歌单详情、歌单全部歌曲
- 本地音乐：选择本地音频文件并解析标题、歌手、专辑、时长、封面
- 本地歌单：创建、更新、删除、添加/移除歌曲、收藏/取消收藏
- 登录体系：二维码登录、手机号密码登录、手机号验证码登录、登录状态查询、退出登录
- 个性化推荐：每日推荐歌单、每日推荐歌曲、个性化推荐歌单
- 喜欢音乐：喜欢/取消喜欢，拉取喜欢列表
- 下载管理：下载目录选择、歌曲下载、下载记录持久化、删除记录与本地文件
- 窗口控制：最小化、最大化/还原、关闭（自定义无边框窗口）

## 项目结构

```text
.
|-- electron-builder.yml
|-- electron.vite.config.mjs
|-- src
|   |-- main
|   |   |-- index.js                     # 主进程，窗口创建 + IPC 业务入口
|   |   |-- auth/login.js                # 登录与 cookie 持久化
|   |   `-- getLocalConfig/playlistconfig.js
|   |                                    # 本地歌单与配置持久化
|   |-- preload
|   |   `-- index.js                     # 暴露 window.api 给渲染进程
|   `-- renderer
|       |-- index.html
|       `-- src
|           |-- App.vue
|           |-- main.js
|           |-- router/index.js          # 路由入口（当前包含 Lyric/PlayerView）
|           |-- stores
|           |   |-- indexStore.js
|           |   |-- playlistStore.js
|           |   |-- searchStore.js
|           |   |-- songStore.js
|           |   `-- userStore.js
|           |-- components
|           |   |-- layout               # 顶部栏/侧边栏/整体布局
|           |   `-- content              # 主内容区（搜索、歌单、我的音乐、设置、下载等）
|           |-- views
|           |   |-- HomeView.vue
|           |   `-- PlayerView.vue       # 歌词页
|           `-- utils
|               |-- downloadUtils.js
|               `-- utils.js
`-- resources
```

## 架构说明

### 进程分层

- Main 进程（`src/main`）
  - 创建窗口、处理系统能力、对接网易云 API、文件下载、读写本地数据
- Preload 进程（`src/preload`）
  - 通过 `contextBridge` 暴露受控 API（`window.api`）
- Renderer 进程（`src/renderer`）
  - Vue 页面与组件，调用 `window.api` 完成功能

### IPC 通信

- 渲染进程通过 `window.api.xxx()` 调用业务能力
- 主进程通过 `ipcMain.handle` 统一处理
- 下载记录和歌单配置写入系统用户数据目录（`app.getPath('userData')`）

## 关键模块

- 登录模块：`src/main/auth/login.js`
  - 使用 `electron-store` 持久化 cookie
  - 重启应用后可恢复登录态
- 本地歌单：`src/main/getLocalConfig/playlistconfig.js`
  - 维护创建歌单/收藏歌单
  - 支持歌单内歌曲增删、封面同步
- 下载模块：`src/main/index.js` + `src/renderer/src/utils/downloadUtils.js`
  - 获取下载地址、保存文件、记录下载历史

## 开发建议

- 推荐 IDE：VS Code + ESLint + Prettier + Volar
- 组件样式以 scss 为主，建议按模块维护（layout/content 分层已建立）
- 新增 IPC 时请同步更新：
  - Main：`ipcMain.handle(...)`
  - Preload：`window.api` 对应方法
  - Renderer：业务调用与类型提示（如需要可补充 d.ts）

## 注意事项

- 本项目依赖第三方网易云接口，接口可用性受网络与上游变更影响。
- 邮箱登录接口当前保留但返回不支持提示（以代码实现为准）。
- 默认启用了跨域相关处理，仅用于桌面应用场景。

## License

当前仓库未声明开源许可证。如需开源，请补充 `LICENSE` 文件并在本 README 中声明。
