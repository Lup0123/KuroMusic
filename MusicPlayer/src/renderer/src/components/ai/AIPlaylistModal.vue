<template>
  <n-modal
    v-model:show="aiPlaylistStore.visible"
    class="ai-chat-modal"
    :class="{ 'ai-window-mode': isAiWindow }"
    preset="card"
    size="huge"
    :bordered="false"
    :style="modalStyle"
    :header-style="headerStyle"
    :body-style="{ padding: 0 }"
    :footer-style="{ padding: 0, borderTop: 'none' }"
    :mask-closable="!isAiWindow"
    :closable="!isAiWindow"
    @close="onModalClose"
  >
    <template #header>
      <div class="chat-header" @dblclick="onHeaderDblClick">
        <div class="header-title">AI 助手</div>
        <div class="header-actions">
          <n-radio-group size="small" :value="aiStore.chatMode" @update:value="onChatModeChange">
            <n-radio-button value="chat">对话讨论</n-radio-button>
            <n-radio-button value="recommend">直接推荐</n-radio-button>
          </n-radio-group>
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
          <template v-if="isAiWindow">
            <n-button size="small" quaternary circle @click="onAiWindowMinimize">
              <template #icon
                ><n-icon><RemoveOutline /></n-icon
              ></template>
            </n-button>
            <n-button size="small" quaternary circle @click="onAiWindowMaximize">
              <template #icon
                ><n-icon
                  ><component :is="isAiWindowMaximized ? ContractOutline : CropOutline" /></n-icon
              ></template>
            </n-button>
            <n-button size="small" quaternary circle @click="onAiWindowClose">
              <template #icon
                ><n-icon><CloseOutline /></n-icon
              ></template>
            </n-button>
          </template>
        </div>
      </div>
    </template>

    <div class="result-layout">
      <aside class="session-sidebar">
        <div class="session-sidebar-header">
          <div class="sidebar-title">历史会话</div>
          <n-button size="tiny" tertiary @click="onCreateSession">
            <template #icon
              ><n-icon><AddOutline /></n-icon
            ></template>
            新建
          </n-button>
        </div>
        <n-scrollbar class="session-scrollbar">
          <div class="session-list">
            <div
              v-for="session in aiStore.sessions"
              :key="session.id"
              class="session-item"
              :class="{ 'is-active': session.id === aiStore.currentSessionId }"
              @click="onSwitchSession(session.id)"
            >
              <div class="session-main">
                <div class="session-name">{{ session.title }}</div>
                <div class="session-preview">{{ getSessionPreview(session) }}</div>
              </div>
              <n-button
                text
                size="tiny"
                class="session-delete"
                :disabled="aiStore.sessions.length <= 1"
                @click.stop="onDeleteSessionById(session.id)"
              >
                <template #icon
                  ><n-icon><TrashOutline /></n-icon></template
                >、
              </n-button>
            </div>
          </div>
        </n-scrollbar>
      </aside>

      <div class="workspace-main">
        <section class="split-content">
          <div class="workspace-switch">
            <n-radio-group
              size="small"
              :value="activeWorkspaceTab"
              @update:value="onWorkspaceTabChange"
            >
              <n-radio-button value="chat"
                >对话
                <span class="tab-count">({{ aiStore.chatMessages.length }})</span></n-radio-button
              >
              <n-radio-button value="diff"
                >Diff
                <span class="tab-count"
                  >({{ pendingDiff.addedSongs.length + pendingDiff.removedSongs.length }})</span
                ></n-radio-button
              >
            </n-radio-group>
            <n-button size="small" tertiary :disabled="!canRollback" @click="onRollbackDraft"
              >回滚</n-button
            >
            <n-button size="small" secondary :disabled="!hasPendingDraft" @click="onApplyOnlyAdded"
              >仅加新歌</n-button
            >
            <n-button
              size="small"
              secondary
              :disabled="!hasPendingDraft"
              @click="onApplyPendingDraft"
              >应用变更</n-button
            >
            <n-button
              size="small"
              type="primary"
              :loading="aiStore.creating"
              :disabled="!draftSongs.length"
              @click="onConfirm"
              >生成歌单</n-button
            >

            <div class="summary-badges">
              <span class="draft-name">{{ draftName || 'AI 草稿歌单' }}</span>
              <n-tag size="small" type="success" :bordered="false" round
                >+{{ pendingDiff.addedSongs.length }}</n-tag
              >
              <n-tag size="small" type="warning" :bordered="false" round
                >-{{ pendingDiff.removedSongs.length }}</n-tag
              >
              <n-tag size="small" :bordered="false" round>共{{ draftSongs.length }}</n-tag>
            </div>
          </div>

          <section v-show="activeWorkspaceTab === 'chat'" class="conversation-panel">
            <n-scrollbar ref="chatBoardRef" class="panel-scroll">
              <div v-if="!aiStore.chatMessages.length" class="conversation-empty">
                <n-empty description="暂无对话，开始和 AI 讨论你的音乐偏好" />
              </div>
              <div v-else class="chat-messages">
                <div
                  v-for="messageItem in aiStore.chatMessages"
                  :key="messageItem.id"
                  :class="`message-${messageItem.role}`"
                  class="message-wrapper"
                >
                  <div class="message-content-block">
                    <div class="message-bubble" :class="`bubble-${messageItem.role}`">
                      <div class="markdown-body" v-html="renderMessage(messageItem.content)"></div>
                    </div>
                    <div class="message-time">{{ formatChatTime(messageItem.time) }}</div>
                  </div>
                </div>
              </div>
            </n-scrollbar>
          </section>

          <section v-show="activeWorkspaceTab === 'diff'" class="diff-section">
            <template v-if="aiStore.chatMode === 'chat'">
              <div class="diff-chat-placeholder">
                <n-empty description="讨论模式下不直接改动歌单，切换“直接推荐”后可查看变更" />
              </div>
            </template>

            <template v-else>
              <div class="diff-toolbar">
                <n-tabs v-model:value="activeDiffTab" type="segment" size="small">
                  <n-tab-pane name="added" :tab="`新增 (${pendingDiff.addedSongs.length})`" />
                  <n-tab-pane name="removed" :tab="`移除 (${pendingDiff.removedSongs.length})`" />
                  <n-tab-pane name="kept" :tab="`保留 (${keptSongs.length})`" />
                </n-tabs>

                <div class="toolbar-actions">
                  <n-input
                    v-model:value="songKeyword"
                    size="small"
                    clearable
                    placeholder="筛选歌曲"
                    class="song-filter-input"
                  />
                  <n-button size="tiny" tertiary @click="onSelectAllCurrentTab">全选</n-button>
                  <n-button size="tiny" tertiary @click="onClearCurrentTab">清空</n-button>
                  <n-button size="tiny" tertiary @click="onInvertCurrentTab">反选</n-button>
                </div>
              </div>

              <div v-if="aiStore.loading" class="diff-skeleton">
                <n-skeleton text :repeat="4" />
                <n-skeleton text style="margin-top: 8px" :repeat="4" />
                <div class="skeleton-tip">正在计算本轮变更，请稍候...</div>
              </div>

              <div v-else-if="!currentTabSongs.length" class="diff-empty">
                <n-empty description="当前分组没有可展示的歌曲" />
              </div>

              <n-scrollbar v-else class="diff-list-scroll">
                <div class="diff-list">
                  <label v-for="song in currentTabSongs" :key="song.id" class="song-row">
                    <div v-if="isSelectableTab" class="song-check">
                      <n-checkbox
                        :checked="isSongSelected(song.id)"
                        @update:checked="onToggleSong(song.id, $event)"
                      />
                    </div>
                    <div v-else class="song-check placeholder"></div>
                    <AppCover
                      :src="song.cover || song.albumCover"
                      :size="64"
                      :width="36"
                      :height="36"
                      :radius="6"
                    />
                    <div class="song-meta">
                      <div class="song-name">{{ song.name }}</div>
                      <div class="song-sub">
                        {{ song.artist || '未知艺术家' }} · {{ song.album || '未知专辑' }}
                      </div>
                    </div>
                    <div class="song-duration">{{ getSongDurationLabel(song) }}</div>
                  </label>
                </div>
              </n-scrollbar>
            </template>
          </section>
        </section>

        <section
          v-show="
            aiStore.chatMode !== 'chat' &&
            (pendingDiff.addedSongs.length || pendingDiff.removedSongs.length)
          "
          class="action-bar"
        >
          <div class="action-summary">
            <span class="action-subtitle">
              预计最终 {{ estimatedFinalCount }} 首 (新增 {{ selectionSummary.added }} / 移除
              {{ selectionSummary.removed }})
            </span>
          </div>
          <div class="action-buttons"></div>
        </section>

        <section class="chat-input-area">
          <div class="input-container" :class="{ 'is-focused': isInputFocused }">
            <n-input
              v-model:value="promptText"
              type="textarea"
              :autosize="{ minRows: 1, maxRows: 4 }"
              :placeholder="
                aiStore.chatMode === 'chat'
                  ? '和 AI 讨论你的偏好、风格、听歌场景...'
                  : '继续描述你想要的变更，例如：去掉重复感强的歌，再补几首夜跑节奏更强的。'
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
    </div>
  </n-modal>
</template>

<script setup>
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import dayjs from 'dayjs'
import { useMessage } from 'naive-ui'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'
import { formatDuration } from '@/utils/utils'
import AppCover from '@/components/common/AppCover.vue'
import {
  AddOutline,
  TimeOutline,
  SendOutline,
  StopOutline,
  TrashOutline,
  RemoveOutline,
  CropOutline,
  CloseOutline,
  ContractOutline
} from '@vicons/ionicons5'

const aiPlaylistStore = useAiPlaylistStore()
const aiStore = aiPlaylistStore
const message = useMessage()

const UNSAFE_PROTOCOL_RE = /^(?:javascript|vbscript|data):/i

function isSafeUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim()
  if (!value) return false
  if (value.startsWith('#') || value.startsWith('/')) return true
  if (value.startsWith('./') || value.startsWith('../')) return true
  if (UNSAFE_PROTOCOL_RE.test(value)) return false
  return /^(https?:|mailto:|tel:)/i.test(value)
}

function sanitizeRenderedHtml(html = '') {
  const text = String(html || '')
  if (!text) return ''

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html')
    const root = doc.body.firstElementChild
    if (!root) return ''

    const blockedTags = new Set([
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'link',
      'meta',
      'base'
    ])
    const elements = root.querySelectorAll('*')

    for (const element of elements) {
      const tag = element.tagName.toLowerCase()
      if (blockedTags.has(tag)) {
        element.remove()
        continue
      }

      const attrs = [...element.attributes]
      for (const attr of attrs) {
        const name = attr.name.toLowerCase()
        const value = String(attr.value || '').trim()
        if (name.startsWith('on') || name === 'style') {
          element.removeAttribute(attr.name)
          continue
        }
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && !isSafeUrl(value)) {
          element.removeAttribute(attr.name)
        }
      }

      if (tag === 'a') {
        const href = element.getAttribute('href') || ''
        if (!isSafeUrl(href)) {
          element.removeAttribute('href')
        } else {
          element.setAttribute('target', '_blank')
          element.setAttribute('rel', 'noopener noreferrer nofollow')
        }
      }
    }

    return root.innerHTML
  } catch {
    return ''
  }
}

const markdownRenderer = new MarkdownIt({ html: false, linkify: true, breaks: true })
markdownRenderer.validateLink = (url) => isSafeUrl(url)
const chatBoardRef = ref(null)
const isInputFocused = ref(false)
const activeDiffTab = ref('added')
const songKeyword = ref('')
const activeWorkspaceTab = ref('chat')
const isAiWindow = ref(false)
const isAiWindowMaximized = ref(false)
let removeWindowMaximizedListener = null

const modalStyle = computed(() =>
  isAiWindow.value
    ? {
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        top: '0',
        margin: 0,
        borderRadius: 0
      }
    : { width: 'min(1180px, calc(100vw - 24px))' }
)

const headerStyle = computed(() =>
  isAiWindow.value
    ? { padding: '12px 16px 10px', borderBottom: '1px solid var(--n-border-color)' }
    : { padding: '12px 16px 10px', borderBottom: '1px solid var(--n-border-color)' }
)
const promptText = computed({
  get: () => aiStore.prompt,
  set: (value) => aiStore.setPrompt(value)
})
const draftSongs = computed(() => aiStore.draftPlaylist?.songs || [])
const draftName = computed(() => aiStore.draftPlaylist?.name || '')
const hasPendingDraft = computed(() => Boolean(aiStore.pendingDraftPlaylist))
const canRollback = computed(() => Boolean(aiStore.lastCommittedDraft))
const pendingDiff = computed(() => aiStore.pendingDraftDiff || { addedSongs: [], removedSongs: [] })

const addedSelection = computed(() => aiStore.pendingDraftSelection?.addedSongIds || [])
const removedSelection = computed(() => aiStore.pendingDraftSelection?.removedSongIds || [])

const keptSongs = computed(() => {
  const currentSongs = aiStore.draftPlaylist?.songs || []
  const removedSet = new Set((pendingDiff.value.removedSongs || []).map((song) => Number(song.id)))
  return currentSongs.filter((song) => !removedSet.has(Number(song.id)))
})

const currentTabSongs = computed(() => {
  const keyword = String(songKeyword.value || '')
    .trim()
    .toLowerCase()
  const baseList =
    activeDiffTab.value === 'added'
      ? pendingDiff.value.addedSongs || []
      : activeDiffTab.value === 'removed'
        ? pendingDiff.value.removedSongs || []
        : keptSongs.value || []

  if (!keyword) return baseList
  return baseList.filter((song) => {
    const text = `${song?.name || ''} ${song?.artist || ''} ${song?.album || ''}`.toLowerCase()
    return text.includes(keyword)
  })
})

const isSelectableTab = computed(
  () => activeDiffTab.value === 'added' || activeDiffTab.value === 'removed'
)

const selectionSummary = computed(() => ({
  added: addedSelection.value.length,
  removed: aiStore.pendingApplyMode === 'only_add' ? 0 : removedSelection.value.length
}))

const estimatedFinalCount = computed(() => {
  const base = aiStore.draftPlaylist?.songs?.length || 0
  return Math.max(0, base + selectionSummary.value.added - selectionSummary.value.removed)
})

const recentPromptOptions = computed(() =>
  (aiStore.recentPrompts || []).map((prompt, index) => ({
    label: prompt,
    key: String(index)
  }))
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

globalThis?.window?.api
  ?.getWindowRole?.()
  .then((role) => {
    isAiWindow.value = role === 'ai'
    if (isAiWindow.value) {
      globalThis?.window?.api
        ?.getAiWindowMaximized?.()
        .then((value) => {
          isAiWindowMaximized.value = Boolean(value)
        })
        .catch(() => {
          isAiWindowMaximized.value = false
        })

      removeWindowMaximizedListener = globalThis?.window?.api?.onAiWindowMaximizedChanged?.((v) => {
        isAiWindowMaximized.value = Boolean(v)
      })
    }
  })
  .catch(() => {
    isAiWindow.value = false
  })

watch(
  () => aiPlaylistStore.visible,
  (showing) => {
    if (!showing && typeof removeWindowMaximizedListener === 'function') {
      removeWindowMaximizedListener()
      removeWindowMaximizedListener = null
    }
  }
)

function onAiWindowKeydown(event) {
  if (!isAiWindow.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    onAiWindowClose()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
    event.preventDefault()
    onAiWindowClose()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'm') {
    event.preventDefault()
    onAiWindowMinimize()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onAiWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onAiWindowKeydown)
  if (typeof removeWindowMaximizedListener === 'function') {
    removeWindowMaximizedListener()
    removeWindowMaximizedListener = null
  }
})

function formatChatTime(timestamp) {
  return timestamp ? dayjs(timestamp).format('HH:mm') : ''
}

function renderMessage(content) {
  const raw = markdownRenderer.render(String(content || '').trim())
  return sanitizeRenderedHtml(raw)
}

function getSongDurationLabel(song) {
  const value = song?.duration
  if (typeof value === 'string' && value.includes(':')) return value
  return formatDuration(Number(song?.dt ?? song?.durationMs ?? value))
}

function isSongSelected(songId) {
  const id = Number(songId)
  if (!id) return false
  if (activeDiffTab.value === 'added') {
    return addedSelection.value.includes(id)
  }
  if (activeDiffTab.value === 'removed') {
    return removedSelection.value.includes(id)
  }
  return false
}

function onToggleSong(songId, checked) {
  if (!checked && !isSongSelected(songId)) return
  if (checked && isSongSelected(songId)) return

  if (activeDiffTab.value === 'added') {
    aiStore.togglePendingAddedSong(songId)
  } else if (activeDiffTab.value === 'removed') {
    aiStore.togglePendingRemovedSong(songId)
  }
}

function onSelectAllCurrentTab() {
  if (activeDiffTab.value === 'added') {
    aiStore.selectAllPendingAddedSongs()
  } else if (activeDiffTab.value === 'removed') {
    aiStore.selectAllPendingRemovedSongs()
  }
}

function onClearCurrentTab() {
  if (activeDiffTab.value === 'added') {
    aiStore.clearPendingAddedSongs()
  } else if (activeDiffTab.value === 'removed') {
    aiStore.clearPendingRemovedSongs()
  }
}

function onInvertCurrentTab() {
  const list = currentTabSongs.value || []
  if (activeDiffTab.value === 'added') {
    for (const song of list) {
      aiStore.togglePendingAddedSong(song.id)
    }
  } else if (activeDiffTab.value === 'removed') {
    for (const song of list) {
      aiStore.togglePendingRemovedSong(song.id)
    }
  }
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
    onModalClose()
    return
  }
  message.error(result?.error || aiStore.error || '创建失败')
}

function onModalClose() {
  if (isAiWindow.value) {
    globalThis?.window?.api?.aiWindowClose?.()
    return
  }
  aiPlaylistStore.closeModal()
}

function onAiWindowMinimize() {
  if (globalThis?.window?.api?.aiWindowMinimize) {
    globalThis.window.api.aiWindowMinimize()
    return
  }
  globalThis?.window?.api?.minimize?.()
}

function onAiWindowMaximize() {
  if (globalThis?.window?.api?.aiWindowMaximize) {
    globalThis.window.api.aiWindowMaximize()
    return
  }
  globalThis?.window?.api?.maximize?.()
}

function onHeaderDblClick() {
  if (!isAiWindow.value) return
  onAiWindowMaximize()
}

function onAiWindowClose() {
  if (globalThis?.window?.api?.aiWindowClose) {
    globalThis.window.api.aiWindowClose()
    return
  }
  globalThis?.window?.api?.close?.()
}

function onApplyPendingDraft() {
  aiStore.setPendingApplyMode('standard')
  const ok = aiStore.applyPendingDraft()
  if (ok) message.success('已应用调整')
}

function onApplyOnlyAdded() {
  aiStore.setPendingApplyMode('only_add')
  const ok = aiStore.applyPendingDraft()
  if (ok) message.success('已仅应用新增歌曲')
}

function onRollbackDraft() {
  const ok = aiStore.rollbackDraft()
  if (ok) message.warning('已回滚')
}

function onCancelGenerate() {
  const canceled = aiStore.cancelCurrentGeneration()
  if (canceled) message.warning('已取消请求')
}

function onChatModeChange(value) {
  aiStore.setChatMode(value)
}

function onWorkspaceTabChange(value) {
  activeWorkspaceTab.value = value === 'diff' ? 'diff' : 'chat'
}

function onCreateSession() {
  aiStore.createSession('')
}

function onDeleteSessionById(sessionId) {
  if (aiStore.sessions.length <= 1) {
    message.warning('至少保留一个会话')
    return
  }
  const removed = aiStore.deleteSession(sessionId)
  if (removed) {
    message.success('已删除会话')
  }
}

function getSessionPreview(session) {
  const list = Array.isArray(session?.chatMessages) ? session.chatMessages : []
  const latest = list[list.length - 1]?.content || ''
  return String(latest || '暂无对话内容').slice(0, 36)
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
  z-index: auto;
}

:deep(.ai-chat-modal .n-card) {
  height: 100%;
}

:deep(.ai-chat-modal .n-card__content) {
  padding: 0 !important;
  overflow: hidden;
}

:deep(.ai-chat-modal .n-card-header .header-actions) {
  -webkit-app-region: no-drag;
}

:deep(.ai-chat-modal .n-card-header .n-radio-group),
:deep(.ai-chat-modal .n-card-header .n-dropdown),
:deep(.ai-chat-modal .n-card-header .n-button) {
  -webkit-app-region: no-drag;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  -webkit-app-region: no-drag;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: drag;
  user-select: none;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.session-select {
  width: 160px;
}

.provider-select {
  width: 90px;
}

.result-layout {
  display: flex;
  flex-direction: row;
  height: 84vh;
  min-height: 640px;
  max-height: 940px;
  background: var(--n-color);
  position: relative;
}

.ai-chat-modal.ai-window-mode .result-layout {
  height: calc(100vh - 64px);
  min-height: 0;
  max-height: none;
  overflow: hidden;
}

.session-sidebar {
  width: 240px;
  border-right: 1px solid var(--n-border-color);
  background: color-mix(in srgb, var(--n-color-modal) 88%, var(--n-color));
  display: flex;
  flex-direction: column;
}

.session-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color);
}

.session-scrollbar {
  flex: 1;
}

.session-list {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--n-primary-color) 32%, var(--n-border-color));
    background: color-mix(in srgb, var(--n-primary-color) 6%, var(--n-color-modal));
  }

  &.is-active {
    border-color: color-mix(in srgb, var(--n-primary-color) 45%, var(--n-border-color));
    background: color-mix(in srgb, var(--n-primary-color) 10%, var(--n-color-modal));
  }
}

.session-main {
  min-width: 0;
  flex: 1;
}

.session-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--n-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-preview {
  margin-top: 3px;
  font-size: 11px;
  color: var(--n-text-color-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-delete {
  opacity: 0.65;
}

.workspace-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.workspace-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--n-border-color);
  background: color-mix(in srgb, var(--n-color-modal) 86%, var(--n-color));
}

.tab-count {
  font-size: 11px;
  opacity: 0.6;
  margin-left: 2px;
}

.summary-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.draft-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.split-content {
  flex: 1;
  min-height: 0;
  display: block;
}

:deep(.workspace-switch .n-radio-group) {
  width: auto;
}

.conversation-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 48px 24px;
}

.panel-scroll {
  flex: 1;
}

.conversation-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conversation-box {
  margin-top: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  padding: 8px;
  background: var(--n-color);
}

.diff-section {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding-bottom: 48px;
}

.diff-chat-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px;
  border: 1px dashed var(--n-border-color);
  border-radius: 10px;
}

.diff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 10px 12px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.song-filter-input {
  width: 180px;
}

.diff-list-scroll {
  flex: 1;
  padding: 0 12px 12px;
}

.diff-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.song-row {
  display: grid;
  grid-template-columns: 24px 36px minmax(0, 1fr) 56px;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color-modal);
}

.song-check.placeholder {
  width: 24px;
}

.song-meta {
  min-width: 0;
}

.song-name {
  font-size: 13px;
  color: var(--n-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--n-text-color-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-duration {
  font-size: 12px;
  color: var(--n-text-color-3);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.diff-skeleton {
  flex: 1;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  padding: 14px;
}

.skeleton-tip {
  margin-top: 12px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.diff-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--n-border-color);
  border-radius: 10px;
}

.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--n-border-color);
  background: var(--n-color-modal);
}

.action-subtitle {
  font-size: 13px;
  font-weight: 500;
  color: var(--n-text-color-2);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-messages.slim {
  gap: 8px;
}

.message-wrapper {
  display: flex;
  gap: 8px;
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
  gap: 4px;
  max-width: 100%;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.45;
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
  font-size: 11px;
  color: var(--n-text-color-3);
  padding: 0 4px;
}

/* Input Area */
.chat-input-area {
  padding: 12px 24px 14px;
  border-top: 1px solid var(--n-border-color);
  background: var(--n-color);
}

.input-container {
  display: flex;
  align-items: flex-end;
  background: var(--n-input-color);
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
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
  .result-layout {
    min-height: 540px;
    flex-direction: column;
  }

  .session-sidebar {
    width: 100%;
    max-height: 140px;
    border-right: none;
    border-bottom: 1px solid var(--n-border-color);
  }

  .split-content {
    display: block;
  }

  .conversation-panel {
    min-height: 180px;
    border: none;
  }

  .summary-section,
  .chat-input-area {
    padding: 0 16px 16px;
  }

  .summary-section {
    padding-top: 12px;
    padding-bottom: 8px;
  }

  .action-bar {
    padding: 10px 16px;
    flex-direction: column;
    align-items: flex-start;
  }

  .action-buttons {
    width: 100%;
    flex-wrap: wrap;
  }

  .song-filter-input {
    width: 120px;
  }

  .message-content-block {
    max-width: 100%;
  }
}
</style>
