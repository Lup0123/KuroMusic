# AGENTS.md — KuroMusic 开发指南

面向在本仓库工作的 AI 代理 / 开发者的项目总纲。阅读本文可快速了解架构、约定、运行方式与近期改动。核心业务说明另见 `README.md`，版本变更见 `CHANGELOG.md`。

---

## 1. 项目概览

**KuroMusic** 是基于 **Electron 38 + Vue 3** 的桌面音乐播放器，通过网易云非官方 API 实现搜索/播放/歌词/歌单，叠加本地音乐、下载管理、迷你播放器、系统托盘、全局快捷键、自动更新，以及一套本地 **AI 语义推荐 / RAG / 行为画像**能力。当前版本 `1.5.0`。

> 仅供学习研究，勿商用。

### 技术栈
- Electron 38、Vue 3 + Vite（`electron-vite`）
- Pinia（状态）、Vue Router（`createMemoryHistory`）
- Naive UI（组件，`unplugin-vue-components` 自动导入）
- `@neteasecloudmusicapienhanced/api`（网易云）
- `electron-store`（本地持久化）、`music-metadata`（本地音频元数据）
- AI：`@applemusic-like-lyrics`（歌词/流动背景）、`@huggingface/transformers`（bge 本地向量）、`better-sqlite3` + `sqlite-vec`（RAG 向量库）、OpenAI 兼容接口（默认阿里云 DashScope `qwen-plus`）

---

## 2. 进程架构（三层）

| 层 | 目录 | 职责 |
|---|---|---|
| **Main** | `src/main/` | 窗口、系统能力（托盘/快捷键/自启/更新）、网易云 API、下载、本地读写、AI 后端。入口 `src/main/index.js`（~1800 行，约 80 个 IPC handler） |
| **Preload** | `src/preload/index.js` | `contextBridge` 暴露 `window.api`（~90 方法），渲染层唯一入口 |
| **Renderer** | `src/renderer/src/` | Vue 页面/组件/Pinia/服务，只通过 `window.api` 调能力 |

**双窗口**：主窗口 + 独立 **AI 助手窗口**（`aiWindow`，1280×720 无边框）。二者共用同一份渲染代码，靠 `window.api.getWindowRole()` 区分：`App.vue` 中 `windowRole==='ai'` 渲染 `AIPlaylistModal`，否则渲染 `router-view`。

**IPC 约定**：新增能力时三处同步——Main `ipcMain.handle('xxx')` → Preload `window.api.xxx` → Renderer 调用。本地数据统一写 `app.getPath('userData')`。

---

## 3. 目录与模块地图

### Main (`src/main/`)
- `index.js` — 窗口 + 全部 IPC + 系统能力 + 网易云 API 封装 + 下载 + 迷你模式(380×88) + 自动更新
- `auth/login.js` — 二维码/手机号/邮箱登录，cookie 持久化（electron-store），重启恢复
- `getLocalConfig/` — `playlistconfig.js`(本地歌单增删改/收藏/封面)、`aiConfig.js`(AI Provider Key/model/baseUrl)、`behaviorConfig.js`(行为埋点开关)
- `ai/` — AI 后端：
  - `embeddingService.js` — 本地 `bge-small-zh-v1.5`（transformers.js），512 维，懒加载+预热，不可用降级 hash 向量
  - `ragService.js` — `better-sqlite3`+`sqlite-vec` 向量库，索引歌词/歌单/偏好，`buildContext` 提供 RAG 上下文
  - `tagLexicon.js` — 200+ 内置标签词库，`findNearestTags` kNN 近义扩展
  - `llmPlaylist.js` — 推荐编排（意图解析→关键词→语义扩展→检索候选→打分去重）
  - `langchainRecommend.js` — LLM 结构化调用(zod schema) + 候选精排 rerank
  - `behaviorTracker.js` / `behaviorAggregator.js` — 行为埋点(切歌/播完/喜欢，评分 1/3/5/-5/-2)，节流批量落库，聚合偏好写回 RAG

### Renderer (`src/renderer/src/`)
- `stores/` — `songStore`(播放引擎核心：队列/随机-列表-单曲循环/下一首/状态持久化)、`playlistStore`、`searchStore`、`userStore`、`indexStore`、`aiPlaylistStore`(AI 会话+草稿歌单，~1400 行)
- `services/` — `player/`(`playbackFailover` 音质降级、`globalShortcuts`)、`ai/`(`providerAdapter` IPC 桥、`ruleProvider` 无 LLM 规则兜底、`previewPlayer` 试听)、`desktopSettings`
- `components/`
  - `layout/` — `layout.vue`(骨架)、`navbar/`、`sidebar/`
  - `content/` — `mainpage`(首页)、`songsearch`、`my-music`、`Myplaylist/playlistDetail`、`player-footer`(播放底栏)、`playlist/songlist`(播放队列抽屉)、`setting`、`artist`、`download`
  - `ai/` — `AIPlaylistModal`、`ConversationPanel`、`DraftPanel`、`SessionSidebar`、`SongRow`、`GuideCards`、`AIFloatBall`
  - `common/` — `AppCover`(带兜底的封面组件)、`StateView`、`SongDurationText`
- `views/` — `PlayerView.vue`(全屏歌词页，见 §6)、`HomeView`
- `utils/` — `image.js`(`normalizeCoverUrl`)、`downloadUtils`、`shortcut`、`utils`
- `router/` — memory history，路由：discover / my-music / search / playlist/:id / artist/:id

### 数据存储（均在 `userData`）
登录 cookie、本地歌单、下载记录、AI 配置 → electron-store；RAG 向量库 → `rag/rag.db`；行为库 → `ai/behavior.db`。AI Key 仅存本机。

---

## 4. 本地开发（⚠️ 本机环境有坑，务必阅读）

### 标准命令
```bash
pnpm dev      # 开发（Windows 下会先 chcp 65001 防中文乱码）
pnpm build    # 构建 out/
pnpm lint     # ESLint
pnpm format   # Prettier
pnpm test     # Vitest
```

### ⚠️ 本机环境问题与绕过方式（重要）
本机 node 由 **Volta** 管理（`C:\Program Files\Volta`），但 PATH 里还混着 `C:\nvm4w\nodejs`（nvm-for-windows）。**pnpm 跑依赖构建脚本时子进程解析不到 `node`**，导致：

1. **`pnpm dev` / `pnpm install` 会卡在原生依赖 postinstall 失败**（electron / better-sqlite3 / onnxruntime-node / sharp 的 `node install.js` 报 `'node' 不是内部或外部命令`）。
2. pnpm 12 已不读 `pnpm.onlyBuiltDependencies`，配置自动迁移到 `pnpm-workspace.yaml` 的 `allowBuilds`。

**绕过方式（在本机启动 dev）**——跳过 pnpm，直接用 node 调 electron-vite：
```bash
node node_modules/electron-vite/bin/electron-vite.js dev
```
（PowerShell 里先 `$env:PATH = 'C:\Program Files\Volta;' + $env:PATH` 确保 node 可用。）

**首次需补的原生二进制**（若缺）：
```bash
# electron 二进制
node node_modules/electron/install.js
# better-sqlite3 针对 electron ABI（electron 38 = ABI 139）的预编译
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3
node <prebuild-install路径>/bin.js --runtime=electron --target=38.8.2 --arch=x64 --platform=win32
```
`onnxruntime-node` 为 napi-v6（跨 ABI 稳定），二进制齐全即可用。

**治本**：清理 Volta / nvm4w 的 PATH 冲突，让 `node` 在 pnpm 子进程里稳定可用，之后 `pnpm rebuild` / `electron-builder install-app-deps` 即正常。

### 直接用 node 跑工具（绕过 pnpm 门禁）
```bash
# eslint / prettier（路径按 .pnpm 实际版本）
node node_modules/.pnpm/eslint@*/node_modules/eslint/bin/eslint.js --quiet <file>
node node_modules/.pnpm/prettier@*/node_modules/prettier/bin/prettier.cjs --write <file>
```

### 验证 dev 启动
`node .../electron-vite.js dev` 后，看输出出现 `dev server running ...` + `start electron app...`，`Get-Process electron` 有进程即成功。渲染进程运行时错误只在 **Electron DevTools Console**（Ctrl+Shift+I），不进 stdout/stderr。

---

## 5. 代码约定

- **格式**：Prettier —— `singleQuote`、`semi:false`、`printWidth:100`、`trailingComma:none`、**`endOfLine: crlf`**。提交前跑 `pnpm lint` / `pnpm format`。仓库存量文件有较多既存 prettier 警告（非本次引入）。
- **样式**：SCSS，按模块 scoped 维护；naive 内部样式用 `:deep()` 覆盖；teleport 内容（drawer/dialog/popover）scoped 触达不到，需非 scoped 全局样式。
- **Naive UI**：组件经 `unplugin-vue-components` + `NaiveUiResolver` 自动导入，模板直接 `<n-xxx>`；但 `darkTheme` 等**非组件对象**需显式 `import { darkTheme } from 'naive-ui'`。
- **动画**：避免 `transition: all`（列具体属性 transform/opacity 等）；`main.css` 有全局 `prefers-reduced-motion` 兜底。
- **无障碍**：图标按钮加 `aria-label`，装饰图标 `aria-hidden`，可点击元素用 `<button>` 而非 `<div @click>`。
- **封面兜底**：统一用 `AppCover` + `utils/image.js` 的 `normalizeCoverUrl`（已拦截失效的 `via.placeholder.com` 死链，返回空交由 ♪ 兜底）。数据层封面字段缺省用 `''`，勿再注入外链占位图。

---

## 6. 全屏歌词页（`views/PlayerView.vue`）

Apple Music 风格，两部分：
- **流动背景**：`@applemusic-like-lyrics/vue` 的 `BackgroundRender`（封面色彩流动网格背景，WebGL）。
  - **坑1**：AMLL 组件根是 `<div style="display:contents">`，真实 canvas 是 append 的子节点——定位/尺寸 CSS 必须加在**外层真实容器**（如 `.amll-bg-box`）上，不能加在组件本身。
  - **坑2**：AMLL v0.2.0 `BackgroundRender` 的 `playing` 逻辑**写反**（`playing ? pause() : resume()`），故传 `:playing="!isPlaying"` 才能在播放时流动。
- **歌词**：**自研 DOM 渲染**（非 AMLL `LyricPlayer`——后者在本布局多次渲染空白，已弃用）。大字、当前行高亮放大居中、上下 mask 淡出、点击跳转、译文在下方；行级 LRC 解析 + 二分定位 currentLine。
- **字号**：在「设置 → 播放设置」的滑块调整，写 `localStorage.lyricFontSize`；歌词页打开时读取（歌词抽屉每次开都重建）。
- 工具栏融入背景：关闭 + 自动滚动（图标常亮=开、变暗=关）。

---

## 7. 深色玻璃外壳（本次视觉改造）

统一「深色玻璃（glassmorphism）」外壳，**不跟随明暗主题**（外壳始终深玻璃、浅色文字），无全局背景。

- **玻璃变量**（`App.vue` 按明暗主题 `watchEffect` 写到 `documentElement`，集中可调）：
  - `--glass-shell-bg` / `--glass-shell-border` —— 三大栏（浅色主题更透 `0.4`、深色 `0.62`）
  - `--glass-panel-bg` / `--glass-panel-border` —— 弹窗/抽屉（更实以保可读）
- **已玻璃化**：navbar、sidebar、player-footer、播放队列抽屉(songlist)、用户信息卡(navbar popover 加 `raw`)、设置抽屉、创建歌单弹窗。
- **naive 组件深色化技巧**：内容多的 drawer/dialog 用 `<n-config-provider :theme="darkTheme" :theme-overrides="{...}">` 包裹，内部所有控件自动深色贴合玻璃；玻璃底用对应组件的 `color` theme-override，磨砂 `backdrop-filter` 对 teleport 内容用**非 scoped 全局样式**（挂 class 限定范围）。
- 内容区卡片（首页/歌单/搜索）目前**跟随主题**，未玻璃化。

**搜索已从顶栏迁移到侧栏顶部**（`searchStore.setSearchKeyword` + 跳 `SONG_SEARCH`）；navbar 瘦身（去掉居中搜索，保留 Logo + 右侧控制，高度仍 60px——`sidebar` 高度用 `calc(100vh - 60px - 80px)` 依赖它）。

---

## 8. 字体

`assets/font/` 内两款：`Tektur-SemiBold.ttf`（拉丁/数字）、`youaimoshouheiti-bold.ttf`（有爱魔兽黑体，中文）。在 `main.css` 用 `@font-face` 定义，全局字体栈 `--app-font-family`（拉丁 Tektur → 中文 YouAiHei → 系统兜底）应用于 `body`/`#app`；naive 通过 `App.vue` themeOverrides.common.fontFamily 使用同栈。

---

## 9. 一次「AI 推荐歌单」链路（参考）

`aiPlaylistStore` → `window.api.aiRecommendPlaylist` → 主进程 `ai-recommend-playlist`：
1. 解析 Provider 配置（context → aiConfig → 环境变量，默认 DashScope qwen-plus）
2. `ragService.buildContext` 注入本地 RAG 上下文
3. `recommendPlaylistByLLM` 编排，注入 `llmClient`(结构化输出) / `searchSongs`(网易云 cloudsearch) / `semanticExpander`(embedding + 标签扩展)
4. 候选 ≥40 首触发 LLM 精排，异步替换
5. 全程降级兜底：模型不可用回退 hash 向量、精排失败保留原序、无 Key 走 `ruleProvider`——**AI 任何环节失败都不影响核心播放**。

---

## 10. 测试

Vitest，覆盖 AI 服务、stores、player services、utils。位于各模块 `__tests__/`。运行：`pnpm test`（或直接 `node node_modules/.pnpm/vitest@*/.../vitest.mjs run` 绕过 pnpm）。
