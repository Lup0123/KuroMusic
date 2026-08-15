# 贡献指南

感谢你愿意为 Kuromusic 贡献代码！请先阅读以下约定，让协作更顺畅。

## 开发环境

- Node.js 18+
- pnpm 8+
- Windows / macOS / Linux

```bash
pnpm install
pnpm dev
```

## 代码质量

提交前请确保本地通过全部检查：

```bash
pnpm lint      # ESLint（含 .vue）
pnpm format    # Prettier
pnpm test      # Vitest 单元测试
```

新增逻辑建议同步补充单元测试（仓库已有 `*.test.js` 用例，运行 `node node_modules/vitest/vitest.mjs run`）。

## 提交规范

建议使用 Conventional Commits 风格：

- `feat:` 新功能
- `fix:` 缺陷修复
- `docs:` 文档
- `refactor:` 重构（不改变行为）
- `test:` 测试
- `chore:` 构建/依赖/工具链

示例：`feat: 支持全局快捷键自定义`

## 新增 IPC 的同步清单

- Main：`ipcMain.handle(...)` / `ipcMain.on(...)`
- Preload：`window.api` 对应方法
- Renderer：业务调用处
- 如有必要：补充类型声明或文档

## 提交 PR 流程

1. Fork 仓库并基于最新 `main` 创建分支（建议前缀：`feat/`、`fix/`、`docs/`）
2. 本地自测通过（lint + test）
3. 打开 PR，按 `.github/PULL_REQUEST_TEMPLATE.md` 填写说明
4. 等待 Review，处理反馈后合并

## 行为准则

- 保持友善、尊重他人
- 讨论围绕代码与功能本身
- 涉及音乐版权、第三方接口合规的问题请先阅读 README 的「免责声明」