# 本地语义向量模型目录

将 `bge-small-zh-v1.5` 的模型文件放在本目录下，构建时会通过
`electron-builder` 的 `extraResources` 打包进应用（离线可用，不进 asar）。

## 获取模型

从 Hugging Face 下载 ONNX 版（推荐量化版以减小体积）：

```text
onnx-community/bge-small-zh-v1.5-ONNX
```

把模型文件放到：

```text
resources/models/bge-small-zh-v1.5/
```

目录内至少需要 `config.json`、`tokenizer.json`（或 `tokenizer_config.json` +
词典文件）以及 ONNX 权重文件。

## 未放置模型时

- 开发环境：`@huggingface/transformers` 会尝试从 Hugging Face 自动下载到
  `userData/huggingface` 缓存（需要联网）。
- 完全不可用时：应用自动回退到 512 维 hash 向量，推荐功能不中断。

## 自定义模型路径

设置环境变量 `AI_EMBED_MODEL_DIR` 指向模型目录即可覆盖默认路径。
