<template>
  <n-modal
    v-model:show="aiPlaylistStore.visible"
    class="ai-chat-modal"
    preset="card"
    size="huge"
    :bordered="false"
    :style="modalStyle"
    :header-style="{ padding: '16px 20px 12px', borderBottom: '1px solid var(--n-border-color)' }"
    :body-style="{ padding: 0 }"
    :footer-style="{ padding: 0, borderTop: 'none' }"
    @close="aiPlaylistStore.closeModal"
  >
    <template #header>
      <div class="chat-header">
        <div class="header-title">✨ AI 助手</div>
        <div class="header-actions">
          <n-select
            class="session-select"
            size="small"
            :value="aiStore.currentSessionId"
            :options="sessionOptions"
            @update:value="onSwitchSession"
          />
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button size="small" quaternary circle @click="onCreateSession">
                <template #icon
                  ><n-icon><AddOutline /></n-icon
                ></template>
              </n-button>
            </template>
            新建会话
          </n-tooltip>
          <n-dropdown
            trigger="click"
            :options="recentPromptOptions"
            :disabled="recentPromptOptions.length === 0"
            @select="onSelectRecentPrompt"
          >
            <n-button size="small" quaternary circle>
              <template #icon
                ><n-icon><TimeOutline /></n-icon
              ></template>
            </n-button>
          </n-dropdown>
          <n-select
            class="provider-select"
            size="small"
            :value="aiStore.providerMode"
            :options="providerOptions"
            @update:value="onProviderModeChange"
          />
        </div>
      </div>
    </template>
    <div class="chat-layout">
      <!-- Chat Board -->
      <n-scrollbar>
        <div ref="chatBoardRef" class="chat-board">
          <div v-if="!aiStore.chatMessages.length" class="chat-welcome">
            <div class="welcome-icon">🎧</div>
            <h3 class="welcome-title">今天想听什么？</h3>
            <p class="welcome-desc">
              描述你喜欢的风格、心情或场景，比如：<br />“帮我找几首适合深夜开车听的 Synthwave 音乐”
            </p>
          </div>

          <div v-else class="chat-messages">
            <div
              v-for="messageItem in aiStore.chatMessages"
              :key="messageItem.id"
              :class="`message-${messageItem.role}`"
              class="message-wrapper"
            >
              <div v-if="messageItem.role === 'assistant'" class="message-avatar">
                <n-avatar
                  round
                  size="medium"
                  :style="{ backgroundColor: 'var(--n-primary-color)', color: '#fff' }"
                  >AI</n-avatar
                >
              </div>

              <div class="message-content-block">
                <div class="message-bubble" :class="`bubble-${messageItem.role}`">
                  <div class="markdown-body" v-html="renderMessage(messageItem.content)"></div>
                </div>
                <div class="message-time">{{ formatChatTime(messageItem.time) }}</div>
              </div>

              <div v-if="messageItem.role === 'user'" class="message-avatar">
                <n-avatar
                  round
                  size="medium"
                  :style="{
                    backgroundColor: 'var(--n-text-color-3)',
                    color: 'var(--n-base-color)'
                  }"
                  >你</n-avatar
                >
              </div>
            </div>
          </div>
        </div>
      </n-scrollbar>

      <!-- Draft Status Banner -->
      <transition name="slide-up">
        <div v-if="draftSongs.length || hasPendingDraft" class="draft-banner">
          <div class="draft-info">
            <span class="draft-icon">🎵</span>
            <div class="draft-text">
              <div class="draft-name">{{ draftName || '未命名歌单' }}</div>
              <div class="draft-count">共 {{ draftSongs.length }} 首歌曲</div>
            </div>
          </div>
          <div class="draft-actions">
            <n-button
              size="small"
              secondary
              :disabled="!hasPendingDraft"
              @click="onApplyPendingDraft"
              >应用调整</n-button
            >
            <n-button size="small" secondary :disabled="!canRollback" @click="onRollbackDraft"
              >回滚</n-button
            >
            <n-button
              size="small"
              type="primary"
              :loading="aiStore.creating"
              :disabled="!draftSongs.length"
              @click="onConfirm"
            >
              创建歌单
            </n-button>
          </div>
        </div>
      </transition>

      <!-- Input Area -->
      <div class="chat-input-area">
        <div class="input-container" :class="{ 'is-focused': isInputFocused }">
          <n-input
            v-model:value="promptText"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 6 }"
            placeholder="告诉 AI 你的听歌需求..."
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
          <span class="footer-text">内容由 AI 生成，可能会有遗漏或不准确。</span>
          <div class="debug-actions">
            <n-button text size="tiny" @click="onExportDebugSnapshot">复制快照</n-button>
            <span class="divider">·</span>
            <n-button text size="tiny" @click="onDownloadDebugSnapshot">下载快照</n-button>
          </div>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import dayjs from 'dayjs'
import { useMessage } from 'naive-ui'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'
import { AddOutline, TimeOutline, SendOutline, StopOutline } from '@vicons/ionicons5'

const aiPlaylistStore = useAiPlaylistStore()
const aiStore = aiPlaylistStore
const message = useMessage()

const markdownRenderer = new MarkdownIt({ html: false, linkify: true, breaks: true })
const sessionRenameDraft = ref('')
const chatBoardRef = ref(null)
const isInputFocused = ref(false)

const providerOptions = [
  { label: '自动', value: 'auto' },
  { label: 'LLM', value: 'llm' },
  { label: '规则', value: 'rule' }
]

const modalStyle = computed(() => ({ width: 'min(860px, calc(100vw - 40px))' }))
const promptText = computed({
  get: () => aiStore.prompt,
  set: (value) => aiStore.setPrompt(value)
})
const draftSongs = computed(() => aiStore.draftPlaylist?.songs || [])
const draftName = computed(() => aiStore.draftPlaylist?.name || '')
const hasPendingDraft = computed(() => Boolean(aiStore.pendingDraftPlaylist))
const canRollback = computed(() => Boolean(aiStore.lastCommittedDraft))

const sessionOptions = computed(() =>
  (aiStore.sessions || []).map((session) => ({ label: session.title, value: session.id }))
)
const recentPromptOptions = computed(() =>
  (aiStore.recentPrompts || []).map((prompt, index) => ({ label: prompt, key: String(index) }))
)

watch(
  () => aiStore.currentSessionId,
  (sessionId) => {
    const current = aiStore.sessions.find((s) => s.id === sessionId)
    sessionRenameDraft.value = current?.title || ''
  },
  { immediate: true }
)

// Scroll to bottom when messages update
watch(
  () => aiStore.chatMessages.length,
  () => {
    nextTick(() => {
      if (chatBoardRef.value) {
        chatBoardRef.value.scrollTop = chatBoardRef.value.scrollHeight
      }
    })
  }
)

aiStore.initializeStore()

function formatChatTime(timestamp) {
  return timestamp ? dayjs(timestamp).format('HH:mm') : ''
}

function renderMessage(content) {
  return markdownRenderer.render(String(content || '').trim())
}

async function onGenerate() {
  const text = promptText.value.trim()
  if (!text) {
    message.warning('请输入需求后发送')
    return
  }
  const result = await aiStore.generateFromPrompt(text)
  if (!result.success && !result.canceled) {
    message.error(result.error || aiStore.error || '生成失败')
  }
}

async function onConfirm() {
  const result = await aiStore.createDraftToLocalPlaylist()
  if (result?.success) {
    message.success(`已创建歌单，添加 ${result.addedSongs || 0} 首`)
    aiPlaylistStore.closeModal()
    return
  }
  message.error(result?.error || aiStore.error || '创建失败')
}

function onApplyPendingDraft() {
  const ok = aiStore.applyPendingDraft()
  if (ok) message.success('已应用调整')
}

function onRollbackDraft() {
  const ok = aiStore.rollbackDraft()
  if (ok) message.warning('已回滚')
}

function onCancelGenerate() {
  const canceled = aiStore.cancelCurrentGeneration()
  if (canceled) message.warning('已取消请求')
}

function onProviderModeChange(value) {
  aiStore.setProviderMode(value)
}

function onCreateSession() {
  aiStore.createSession('')
}

function onSwitchSession(value) {
  aiStore.switchSession(value)
}

async function onSelectRecentPrompt(key) {
  const index = Number(key)
  if (!Number.isInteger(index)) return
  await aiStore.reusePromptByIndex(index)
}

async function onExportDebugSnapshot() {
  try {
    const snapshot = aiStore.buildDebugSnapshot()
    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
    message.success('已复制调试快照')
  } catch {
    message.error('复制失败')
  }
}

function onDownloadDebugSnapshot() {
  try {
    const snapshot = aiStore.buildDebugSnapshot()
    const payload = JSON.stringify(snapshot, null, 2)
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `ai-debug-snapshot-${dayjs().format('YYYYMMDD-HHmmss')}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    message.success('已下载调试快照')
  } catch {
    message.error('下载失败')
  }
}
</script>

<style scoped lang="scss">
.ai-chat-modal {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-select {
  width: 160px;
}

.provider-select {
  width: 90px;
}

.chat-layout {
  display: flex;
  flex-direction: column;
  height: 70vh;
  min-height: 500px;
  max-height: 800px;
  background: var(--n-color);
  position: relative;
}

/* Chat Board Area */
.chat-board {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.chat-welcome {
  margin: auto;
  text-align: center;
  padding: 40px 20px;
  opacity: 0.8;

  .welcome-icon {
    font-size: 64px;
    margin-bottom: 20px;
    filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1));
  }

  .welcome-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--n-text-color);
  }

  .welcome-desc {
    font-size: 14px;
    color: var(--n-text-color-3);
    line-height: 1.6;
  }
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.message-wrapper {
  display: flex;
  gap: 16px;
  max-width: 100%;
}

.message-user {
  justify-content: flex-end;

  .message-content-block {
    align-items: flex-end;
  }
}

.message-assistant {
  justify-content: flex-start;

  .message-content-block {
    align-items: flex-start;
  }
}

.message-content-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 75%;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.6;
  position: relative;
  word-wrap: break-word;

  .markdown-body {
    color: inherit;

    :deep(p) {
      margin: 0;
    }
    :deep(p + p) {
      margin-top: 10px;
    }
    :deep(ul),
    :deep(ol) {
      margin: 8px 0;
      padding-left: 20px;
    }
    :deep(strong) {
      font-weight: 600;
    }
  }
}

.bubble-user {
  background: var(--n-primary-color);
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--n-primary-color) 30%, transparent);
}

.bubble-assistant {
  background: var(--n-color-modal);
  color: var(--n-text-color);
  border: 1px solid var(--n-border-color);
  border-bottom-left-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.message-time {
  font-size: 12px;
  color: var(--n-text-color-3);
  padding: 0 4px;
}

/* Draft Banner */
.draft-banner {
  margin: 0 32px 16px;
  padding: 12px 16px;
  background: color-mix(in srgb, var(--n-primary-color) 8%, var(--n-color));
  border: 1px solid color-mix(in srgb, var(--n-primary-color) 20%, transparent);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.draft-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.draft-icon {
  font-size: 20px;
  background: var(--n-primary-color);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.draft-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--n-text-color);
}

.draft-count {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.draft-actions {
  display: flex;
  gap: 8px;
}

/* Input Area */
.chat-input-area {
  padding: 0 32px 24px;
  background: var(--n-color);
}

.input-container {
  display: flex;
  align-items: flex-end;
  background: var(--n-input-color);
  border: 1px solid var(--n-border-color);
  border-radius: 16px;
  padding: 8px 8px 8px 16px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);

  &.is-focused {
    border-color: var(--n-primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-primary-color) 20%, transparent);
    background: var(--n-color);
  }
}

.chat-textarea {
  flex: 1;
  font-size: 14px;
  padding: 4px 0;

  :deep(.n-input__textarea-el) {
    padding-right: 12px;
  }
}

.input-actions-inside {
  padding-bottom: 2px;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding: 0 4px;
}

.footer-text {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.debug-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--n-text-color-3);

  .divider {
    font-size: 12px;
    opacity: 0.5;
  }
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 768px) {
  .chat-board {
    padding: 16px;
  }
  .chat-input-area {
    padding: 0 16px 16px;
  }
  .draft-banner {
    margin: 0 16px 16px;
  }
  .message-content-block {
    max-width: 85%;
  }
}
</style>
