<template>
  <div class="conversation-panel">
    <n-scrollbar ref="chatBoardRef" class="panel-scroll">
      <div v-if="!aiStore.chatMessages.length" class="conversation-empty">
        <div class="conversation-empty-title">想听点什么？</div>
        <div class="conversation-empty-sub">选一个场景，或直接在下方描述你的需求</div>
        <GuideCards @pick="onGuidePick" />
      </div>
      <div v-else class="chat-messages">
        <div
          v-for="messageItem in aiStore.chatMessages"
          :key="messageItem.id"
          :class="`message-${messageItem.role}`"
          class="message-wrapper"
        >
          <div v-if="messageItem.role === 'assistant'" class="message-avatar">
            <n-icon><SparklesOutline /></n-icon>
          </div>
          <div class="message-content-block">
            <div class="message-bubble" :class="`bubble-${messageItem.role}`">
              <div
                v-if="!isThinkingMessage(messageItem)"
                class="markdown-body"
                v-html="
                  isStreamingMessage(messageItem)
                    ? renderStreamingContent(messageItem.content)
                    : renderMessage(messageItem.content)
                "
              ></div>
              <div v-else class="typing-dots">
                <span></span><span></span><span></span>
              </div>
              <span v-if="showStreamingCursor(messageItem)" class="streaming-cursor"></span>
            </div>
            <div class="message-time">{{ formatChatTime(messageItem.time) }}</div>
          </div>
        </div>
      </div>
    </n-scrollbar>

    <section class="chat-input-area">
      <div class="input-container" :class="{ 'is-focused': isInputFocused }">
        <n-input
          v-model:value="promptText"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          :placeholder="
            aiStore.chatMode === 'chat'
              ? '和 AI 讨论你的偏好、风格、听歌场景...'
              : '描述你想要的音乐，例如：夜跑动感一点，去掉重复感强的歌'
          "
          class="chat-textarea"
          :bordered="false"
          @focus="isInputFocused = true"
          @blur="isInputFocused = false"
          @keydown.enter.exact.prevent="onGenerate"
        />
        <div class="input-actions-inside">
          <n-button
            v-if="aiStore.loading"
            circle
            type="error"
            size="small"
            @click="onCancelGenerate"
          >
            <template #icon
              ><n-icon><StopOutline /></n-icon
            ></template>
          </n-button>
          <n-button
            v-else
            circle
            type="primary"
            size="small"
            :disabled="!promptText.trim()"
            :loading="aiStore.loading"
            @click="onGenerate"
          >
            <template #icon
              ><n-icon><SendOutline /></n-icon
            ></template>
          </n-button>
        </div>
      </div>
      <div class="input-footer">
        <div class="debug-actions">
          <n-button text size="tiny" @click="onExportDebugSnapshot">复制快照</n-button>
          <span class="divider">·</span>
          <n-button text size="tiny" @click="onDownloadDebugSnapshot">下载快照</n-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, computed } from "vue";
import MarkdownIt from "markdown-it";
import dayjs from "dayjs";
import { useMessage } from "naive-ui";
import { useAiPlaylistStore } from "@/stores/aiPlaylistStore";
import { SendOutline, StopOutline, SparklesOutline } from "@vicons/ionicons5";
import GuideCards from "@/components/ai/GuideCards.vue";

const aiStore = useAiPlaylistStore();
const message = useMessage();
const chatBoardRef = ref(null);
const isInputFocused = ref(false);

const UNSAFE_PROTOCOL_RE = /^(?:javascript|vbscript|data):/i;

function isSafeUrl(rawUrl = "") {
  const value = String(rawUrl || "").trim();
  if (!value) return false;
  if (value.startsWith("#") || value.startsWith("/")) return true;
  if (value.startsWith("./") || value.startsWith("../")) return true;
  if (UNSAFE_PROTOCOL_RE.test(value)) return false;
  return /^(https?:|mailto:|tel:)/i.test(value);
}

function sanitizeRenderedHtml(html = "") {
  const text = String(html || "");
  if (!text) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${text}</div>`, "text/html");
    const root = doc.body.firstElementChild;
    if (!root) return "";

    const blockedTags = new Set([
      "script",
      "style",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
      "base"
    ]);
    const elements = root.querySelectorAll("*");

    for (const element of elements) {
      const tag = element.tagName.toLowerCase();
      if (blockedTags.has(tag)) {
        element.remove();
        continue;
      }
      const attrs = [...element.attributes];
      for (const attr of attrs) {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "").trim();
        if (name.startsWith("on") || name === "style") {
          element.removeAttribute(attr.name);
          continue;
        }
        if (
          (name === "href" || name === "src" || name === "xlink:href") &&
          !isSafeUrl(value)
        ) {
          element.removeAttribute(attr.name);
        }
      }
      if (tag === "a") {
        const href = element.getAttribute("href") || "";
        if (!isSafeUrl(href)) {
          element.removeAttribute("href");
        } else {
          element.setAttribute("target", "_blank");
          element.setAttribute("rel", "noopener noreferrer nofollow");
        }
      }
    }
    return root.innerHTML;
  } catch {
    return "";
  }
}

const markdownRenderer = new MarkdownIt({ html: false, linkify: true, breaks: true });
markdownRenderer.validateLink = (url) => isSafeUrl(url);

const promptText = computed({
  get: () => aiStore.prompt,
  set: (value) => aiStore.setPrompt(value)
});

watch(
  () => aiStore.chatMessages.length,
  () => {
    nextTick(() => {
      if (chatBoardRef.value) {
        chatBoardRef.value.scrollTop = chatBoardRef.value.scrollHeight;
      }
    });
  }
);

function formatChatTime(timestamp) {
  return timestamp ? dayjs(timestamp).format("HH:mm") : "";
}

function isStreamingMessage(messageItem) {
  return messageItem?.type === "streaming";
}

function isThinkingMessage(messageItem) {
  return (
    isStreamingMessage(messageItem) &&
    (!String(messageItem?.content || "").trim() || Boolean(messageItem?.meta?.placeholder))
  );
}

function showStreamingCursor(messageItem) {
  return isStreamingMessage(messageItem) && !isThinkingMessage(messageItem);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Lightweight render while streaming: escape HTML + keep line breaks.
// Full markdown rendering happens once when the stream finishes.
function renderStreamingContent(content) {
  return String(content || '')
    .split('\n')
    .map(escapeHtml)
    .join('<br>');
}

function renderMessage(content) {
  const raw = markdownRenderer.render(String(content || "").trim());
  return sanitizeRenderedHtml(raw);
}

async function onGenerate() {
  const text = promptText.value.trim();
  if (!text) {
    message.warning("请输入需求后发送");
    return;
  }
  const result = await aiStore.generateFromPrompt(text);
  if (!result.success && !result.canceled) {
    message.error(result.error || aiStore.error || "生成失败");
  }
}

function onGuidePick(scenePrompt) {
  if (!scenePrompt) return;
  aiStore.setPrompt(scenePrompt);
  aiStore.setChatMode("recommend");
  aiStore.generateFromPrompt(scenePrompt);
}

function onCancelGenerate() {
  const canceled = aiStore.cancelCurrentGeneration();
  if (canceled) message.warning("已取消请求");
}

async function onExportDebugSnapshot() {
  try {
    const snapshot = aiStore.buildDebugSnapshot();
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    message.success("已复制调试快照");
  } catch {
    message.error("复制失败");
  }
}

function onDownloadDebugSnapshot() {
  try {
    const snapshot = aiStore.buildDebugSnapshot();
    const payload = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-debug-snapshot-${dayjs().format("YYYYMMDD-HHmmss")}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    message.success("已下载调试快照");
  } catch {
    message.error("下载失败");
  }
}
</script>

<style scoped lang="scss">
.conversation-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-scroll {
  flex: 1;
  min-height: 0;
}

.conversation-empty {
  padding: 8px 0;
}

.conversation-empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--n-text-color);
  text-align: center;
  margin-top: 28px;
}

.conversation-empty-sub {
  font-size: 13px;
  color: var(--n-text-color-3);
  text-align: center;
  margin-top: 6px;
}

.chat-messages {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-wrapper {
  display: flex;
  animation: message-slide-in 0.22s ease;
  gap: 8px;
}

.message-user {
  justify-content: flex-end;
}

.message-assistant {
  justify-content: flex-start;
}

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  color: var(--primary-color, var(--n-primary-color));
  background: color-mix(
    in srgb,
    var(--primary-color, var(--n-primary-color)) 14%,
    transparent
  );
}

.message-content-block {
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.message-user .message-content-block {
  align-items: flex-end;
}

.message-assistant .message-content-block {
  align-items: flex-start;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
}

.bubble-user {
  background: var(--primary-color, var(--n-primary-color));
  color: #fff;
  border-bottom-right-radius: 4px;
}

.bubble-assistant {
  background: color-mix(in srgb, var(--n-text-color) 6%, transparent);
  border: 1px solid var(--n-border-color);
  color: var(--n-text-color);
  border-bottom-left-radius: 4px;
}

.markdown-body p {
  margin: 0 0 8px;
}

.markdown-body p:last-child {
  margin-bottom: 0;
}

.markdown-body ul,
.markdown-body ol {
  padding-left: 18px;
  margin: 4px 0;
}

.markdown-body code {
  font-family: ui-monospace, SFMono-Regular, Consolas, "Courier New", monospace;
  font-size: 12px;
  background: color-mix(in srgb, var(--n-text-color) 10%, transparent);
  padding: 1px 5px;
  border-radius: 4px;
}

.markdown-body pre {
  background: color-mix(in srgb, var(--n-text-color) 8%, transparent);
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 8px 0;
}

.markdown-body pre code {
  background: transparent;
  padding: 0;
}

.markdown-body a {
  color: var(--primary-color, var(--n-primary-color));
}

.typing-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 2px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

.streaming-cursor {
  display: inline-block;
  width: 8px;
  height: 15px;
  margin-left: 2px;
  vertical-align: text-bottom;
  border-radius: 1px;
  background: currentColor;
  animation: cursor-blink 1s steps(2, start) infinite;
}

.message-time {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.chat-input-area {
  border-top: 1px solid var(--n-border-color);
  padding: 10px 14px;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  padding: 6px 8px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;

  &.is-focused {
    border-color: var(--primary-color, var(--n-primary-color));
    box-shadow: 0 0 0 2px color-mix(
      in srgb,
      var(--primary-color, var(--n-primary-color)) 18%,
      transparent
    );
  }
}

.chat-textarea {
  flex: 1;
}

.input-actions-inside {
  flex-shrink: 0;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.debug-actions {
  color: var(--n-text-color-3);
}

.divider {
  margin: 0 6px;
}

@keyframes message-slide-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes typing-bounce {
  0%,
  60%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@keyframes cursor-blink {
  to {
    visibility: hidden;
  }
}
</style>
