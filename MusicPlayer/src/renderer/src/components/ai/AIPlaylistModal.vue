<template>
  <n-modal
    v-model:show="aiPlaylistStore.visible"
    preset="card"
    class="ai-playlist-modal"
    title="AI 歌单助手"
    size="huge"
    :bordered="false"
    :segmented="{ content: true, footer: 'soft' }"
    :style="modalStyle"
    @close="aiPlaylistStore.closeModal"
  >
    <div class="ai-playlist-modal__content">
      <div class="ai-playlist-modal__prompt">
        <div class="session-panel">
          <n-button size="small" @click="onCreateSession">新建会话</n-button>
          <n-select
            class="session-select"
            size="small"
            :value="aiStore.currentSessionId"
            :options="sessionOptions"
            @update:value="onSwitchSession"
          />
          <n-input
            class="session-rename-input"
            size="small"
            :value="sessionRenameDraft"
            placeholder="会话名称"
            @update:value="onSessionRenameInput"
            @keydown.enter.prevent="onRenameSession"
          />
          <n-button size="small" quaternary @click="onRenameSession">重命名</n-button>
          <n-button size="small" quaternary type="error" @click="onDeleteSession">删除</n-button>
        </div>

        <ul class="session-order-list">
          <li
            v-for="(session, index) in aiStore.sessions"
            :key="session.id"
            class="session-order-item"
            draggable="true"
            @dragstart="onSessionDragStart(index)"
            @dragover.prevent
            @drop="onSessionDrop(index)"
          >
            <span class="session-order-item__title">{{ session.title }}</span>
            <span class="session-order-item__drag">↕</span>
          </li>
        </ul>

        <n-input
          v-model:value="promptText"
          type="textarea"
          placeholder="例如：想要一份适合夜跑的中文流行与电子混合歌单"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
        <div class="ai-playlist-modal__actions-row">
          <n-dropdown
            trigger="click"
            :options="recentPromptOptions"
            :disabled="recentPromptOptions.length === 0"
            @select="onSelectRecentPrompt"
          >
            <n-button quaternary>复用历史</n-button>
          </n-dropdown>
          <n-select
            class="provider-mode-select"
            size="small"
            :value="aiStore.providerMode"
            :options="providerOptions"
            @update:value="onProviderModeChange"
          />
          <n-button type="primary" :loading="aiStore.loading" @click="onGenerate">
            生成推荐
          </n-button>
          <n-button v-if="aiStore.loading" quaternary type="warning" @click="onCancelGenerate">
            取消生成
          </n-button>
        </div>
      </div>

      <n-alert v-if="aiStore.error" type="error" :show-icon="false">
        {{ aiStore.error }}
      </n-alert>

      <n-spin :show="aiStore.loading">
        <div class="ai-playlist-modal__section">
          <div class="section-head">
            <h4 class="section-title">AI 对话</h4>
            <span class="section-meta">{{ aiStore.chatMessages.length }} 条</span>
          </div>
          <ul v-if="aiStore.chatMessages.length" class="simple-list chat-list">
            <li
              v-for="messageItem in aiStore.chatMessages"
              :key="messageItem.id"
              class="chat-item"
              :class="`chat-item--${messageItem.role}`"
            >
              <div class="chat-meta">
                <div class="chat-meta-left">
                  <span class="chat-role">{{ messageItem.role === 'user' ? '你' : 'AI' }}</span>
                  <span class="chat-provider">{{ messageItem.provider || 'rule' }}</span>
                  <span
                    v-if="messageItem.type && messageItem.type !== 'text'"
                    class="chat-type-tag"
                  >
                    {{ mapMessageType(messageItem.type) }}
                  </span>
                </div>
                <span class="chat-time">{{ formatChatTime(messageItem.time) }}</span>
              </div>
              <div class="chat-content" v-html="renderMessage(messageItem.content)"></div>
              <div v-if="messageItem.meta?.intent || messageItem.meta?.reason" class="chat-extra">
                <span v-if="messageItem.meta?.intent">方向：{{ messageItem.meta.intent }}</span>
                <span v-if="messageItem.meta?.reason">原因：{{ messageItem.meta.reason }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="section-empty">还没有对话记录，先输入你的听歌需求。</p>
        </div>

        <div class="ai-playlist-modal__section">
          <h4 class="section-title">推荐说明</h4>
          <ul v-if="aiStore.recommendations.length" class="simple-list">
            <li v-for="(item, index) in aiStore.recommendations" :key="`rec-${index}`">
              {{ formatRecommendation(item, index) }}
            </li>
          </ul>
          <p v-else class="section-empty">暂无推荐，先输入提示词并生成。</p>
        </div>

        <div class="ai-playlist-modal__section">
          <div class="section-head">
            <h4 class="section-title">草稿预览</h4>
            <span v-if="draftSongs.length" class="section-meta">{{ draftSongs.length }} 首</span>
          </div>

          <div v-if="hasPendingDraft" class="pending-adjustment">
            <div class="pending-adjustment__text">
              已生成调整草稿：{{ pendingDraftName }}
              <span v-if="adjustmentReason">（{{ adjustmentReason }}）</span>
            </div>
            <div v-if="adjustmentIntent" class="pending-adjustment__intent">
              本次调整方向：{{ adjustmentIntent }}
            </div>
            <div class="pending-adjustment__mode">
              <n-radio-group
                size="small"
                :value="pendingApplyMode"
                @update:value="onPendingApplyModeChange"
              >
                <n-radio-button value="standard">标准应用</n-radio-button>
                <n-radio-button value="only_add">仅新增不移除</n-radio-button>
              </n-radio-group>
            </div>
            <div
              v-if="addedDiffSongs.length || removedDiffSongs.length"
              class="pending-adjustment__diff"
            >
              <div v-if="addedDiffSongs.length" class="pending-adjustment__diff-item">
                <span class="diff-label">新增 {{ addedDiffSongs.length }} 首：</span>
                <span class="diff-content">{{ summarizeSongs(addedDiffSongs) }}</span>
                <span class="pending-adjustment__quick-actions">
                  <n-button text size="tiny" @click="onSelectAllAdded">全选新增</n-button>
                  <n-button text size="tiny" @click="onClearAdded">清空新增</n-button>
                </span>
              </div>
              <div v-if="addedDiffSongs.length" class="pending-adjustment__toggle-list">
                <n-tag
                  v-for="song in addedDiffSongs"
                  :key="`add-${song.id}`"
                  :type="isAddedSelected(song.id) ? 'success' : 'default'"
                  checkable
                  :checked="isAddedSelected(song.id)"
                  @update:checked="() => toggleAddedSong(song.id)"
                >
                  {{ song.name }}
                </n-tag>
              </div>
              <div v-if="removedDiffSongs.length" class="pending-adjustment__diff-item">
                <span class="diff-label">移除 {{ removedDiffSongs.length }} 首：</span>
                <span class="diff-content">{{ summarizeSongs(removedDiffSongs) }}</span>
                <span class="pending-adjustment__quick-actions">
                  <n-button text size="tiny" @click="onSelectAllRemoved">全选移除</n-button>
                  <n-button text size="tiny" @click="onClearRemoved">清空移除</n-button>
                </span>
              </div>
              <div
                v-if="removedDiffSongs.length && pendingApplyMode !== 'only_add'"
                class="pending-adjustment__toggle-list"
              >
                <n-tag
                  v-for="song in removedDiffSongs"
                  :key="`remove-${song.id}`"
                  :type="isRemovedSelected(song.id) ? 'error' : 'default'"
                  checkable
                  :checked="isRemovedSelected(song.id)"
                  @update:checked="() => toggleRemovedSong(song.id)"
                >
                  {{ song.name }}
                </n-tag>
              </div>
            </div>
            <div class="pending-adjustment__actions">
              <n-button size="small" type="primary" @click="onApplyPendingDraft">应用调整</n-button>
              <n-button size="small" @click="onRollbackDraft">回滚上一个草稿</n-button>
            </div>
          </div>

          <n-input
            v-model:value="draftName"
            :disabled="!aiStore.draftPlaylist"
            placeholder="草稿歌单名"
          />

          <ul v-if="draftSongs.length" class="simple-list draft-song-list">
            <li v-for="(song, index) in draftSongs" :key="song.id ?? `${song.name}-${index}`">
              {{ formatSong(song, index) }}
            </li>
          </ul>
          <p v-else class="section-empty">暂无草稿歌曲。</p>
        </div>

        <div v-if="failedSongs.length" class="ai-playlist-modal__section">
          <div class="section-head">
            <h4 class="section-title">失败歌曲</h4>
            <n-button text type="primary" :loading="aiStore.creating" @click="onRetryFailedSongs">
              重试添加
            </n-button>
          </div>
          <ul class="simple-list draft-song-list">
            <li v-for="(song, index) in failedSongs" :key="song.id ?? `failed-${index}`">
              {{ formatSong(song, index) }}
            </li>
          </ul>
          <ul v-if="failedSongDetails.length" class="simple-list fail-reason-list">
            <li v-for="(item, index) in failedSongDetails" :key="`fail-reason-${index}`">
              {{ item.song?.name || '未知歌曲' }}：{{ mapFailureReason(item.reason) }}
            </li>
          </ul>
        </div>
      </n-spin>
    </div>

    <template #footer>
      <div class="ai-playlist-modal__footer">
        <n-button class="debug-export-btn" text @click="onExportDebugSnapshot">
          导出调试快照
        </n-button>
        <n-button class="debug-export-btn" text @click="onDownloadDebugSnapshot">
          下载调试快照
        </n-button>
        <n-button @click="aiPlaylistStore.closeModal">取消</n-button>
        <n-button
          type="primary"
          :loading="aiStore.creating"
          :disabled="!draftSongs.length"
          @click="onConfirm"
        >
          创建本地歌单
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
import { computed } from 'vue'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MarkdownIt from 'markdown-it'
import dayjs from 'dayjs'
import { useMessage } from 'naive-ui'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'
import { ROUTE_NAMES } from '@/router/routeNames'

const aiPlaylistStore = useAiPlaylistStore()
const aiStore = aiPlaylistStore
const message = useMessage()
const router = useRouter()
const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true
})
const sessionRenameDraft = ref('')
const draggingSessionIndex = ref(-1)
const providerOptions = [
  { label: '自动模式', value: 'auto' },
  { label: '仅 LLM', value: 'llm' },
  { label: '仅规则', value: 'rule' }
]
const recentPromptOptions = computed(() =>
  (aiStore.recentPrompts || []).map((prompt, index) => ({
    label: prompt,
    key: String(index)
  }))
)
const sessionOptions = computed(() =>
  (aiStore.sessions || []).map((session) => ({
    label: session.title,
    value: session.id
  }))
)

aiStore.initializeStore()

watch(
  () => aiStore.currentSessionId,
  (sessionId) => {
    const current = aiStore.sessions.find((s) => s.id === sessionId)
    sessionRenameDraft.value = current?.title || ''
  },
  { immediate: true }
)

const promptText = computed({
  get: () => aiStore.prompt,
  set: (value) => aiStore.setPrompt(value)
})

const draftSongs = computed(() => aiStore.draftPlaylist?.songs || [])
const failedSongs = computed(() => aiStore.lastCreateResult?.failedSongs || [])
const failedSongDetails = computed(() => aiStore.lastCreateResult?.failedSongDetails || [])
const hasPendingDraft = computed(() => Boolean(aiStore.pendingDraftPlaylist))
const pendingDraftName = computed(() => aiStore.pendingDraftPlaylist?.name || '')
const adjustmentReason = computed(() => aiStore.lastAdjustmentMeta?.reason || '')
const adjustmentIntent = computed(() => aiStore.lastAdjustmentMeta?.intent || '')
const addedDiffSongs = computed(() => aiStore.pendingDraftDiff?.addedSongs || [])
const removedDiffSongs = computed(() => aiStore.pendingDraftDiff?.removedSongs || [])
const pendingApplyMode = computed(() => aiStore.pendingApplyMode)

const draftName = computed({
  get: () => aiStore.draftPlaylist?.name || '',
  set: (value) => {
    if (!aiStore.draftPlaylist) return
    aiStore.draftPlaylist.name = String(value ?? '')
  }
})

const modalStyle = computed(() => ({
  width: 'min(760px, calc(100vw - 24px))'
}))

function formatRecommendation(item, index) {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return `推荐 ${index + 1}`

  const title = item.title || item.name || item.reason || `推荐 ${index + 1}`
  const desc = item.description || item.summary || ''
  return desc ? `${title} - ${desc}` : title
}

function formatSong(song, index) {
  if (!song || typeof song !== 'object') return `歌曲 ${index + 1}`
  const artistText = Array.isArray(song.artists)
    ? song.artists
        .map((artist) => artist?.name || artist)
        .filter(Boolean)
        .join('/')
    : song.artist || ''
  return artistText
    ? `${song.name || `歌曲 ${index + 1}`} - ${artistText}`
    : song.name || `歌曲 ${index + 1}`
}

function summarizeSongs(songs) {
  const visible = (songs || [])
    .slice(0, 3)
    .map((song) => song?.name)
    .filter(Boolean)
  if (visible.length === 0) return ''
  return (songs || []).length > 3 ? `${visible.join(' / ')} 等` : visible.join(' / ')
}

function isAddedSelected(songId) {
  return aiStore.pendingDraftSelection.addedSongIds.includes(songId)
}

function isRemovedSelected(songId) {
  return aiStore.pendingDraftSelection.removedSongIds.includes(songId)
}

function toggleAddedSong(songId) {
  aiStore.togglePendingAddedSong(songId)
}

function toggleRemovedSong(songId) {
  aiStore.togglePendingRemovedSong(songId)
}

function onPendingApplyModeChange(value) {
  aiStore.setPendingApplyMode(value)
}

function onCancelGenerate() {
  const canceled = aiStore.cancelCurrentGeneration()
  if (canceled) {
    message.warning('已取消当前生成请求')
  }
}

function onSelectAllAdded() {
  aiStore.selectAllPendingAddedSongs()
}

function onClearAdded() {
  aiStore.clearPendingAddedSongs()
}

function onSelectAllRemoved() {
  aiStore.selectAllPendingRemovedSongs()
}

function onClearRemoved() {
  aiStore.clearPendingRemovedSongs()
}

async function onExportDebugSnapshot() {
  try {
    const snapshot = aiStore.buildDebugSnapshot()
    const payload = JSON.stringify(snapshot, null, 2)
    await navigator.clipboard.writeText(payload)
    message.success('调试快照已复制到剪贴板')
  } catch {
    message.error('复制调试快照失败')
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
    message.success('调试快照已下载')
  } catch {
    message.error('下载调试快照失败')
  }
}

function onProviderModeChange(value) {
  aiStore.setProviderMode(value)
}

function onCreateSession() {
  const sessionId = aiStore.createSession('')
  const created = aiStore.sessions.find((s) => s.id === sessionId)
  sessionRenameDraft.value = created?.title || ''
}

function onSwitchSession(value) {
  aiStore.switchSession(value)
}

function onSessionRenameInput(value) {
  sessionRenameDraft.value = String(value || '')
}

function onRenameSession() {
  const ok = aiStore.renameSession(aiStore.currentSessionId, sessionRenameDraft.value)
  if (!ok) {
    message.warning('请输入有效会话名称')
  }
}

function onDeleteSession() {
  const ok = aiStore.deleteSession(aiStore.currentSessionId)
  if (!ok) {
    message.warning('至少保留一个会话')
  }
}

function onSessionDragStart(index) {
  draggingSessionIndex.value = index
}

function onSessionDrop(index) {
  if (draggingSessionIndex.value < 0) return
  const ok = aiStore.reorderSessions(draggingSessionIndex.value, index)
  draggingSessionIndex.value = -1
  if (!ok) {
    message.warning('会话排序失败')
  }
}

async function onSelectRecentPrompt(key) {
  const index = Number(key)
  if (!Number.isInteger(index)) return
  const result = await aiStore.reusePromptByIndex(index)
  if (!result?.success) {
    message.error('复用历史提示词失败')
  }
}

function renderMessage(content) {
  const text = String(content || '').trim()
  if (!text) return ''
  return markdownRenderer.render(text)
}

function mapMessageType(type) {
  const map = {
    recommendation: '推荐',
    error: '错误',
    status: '状态',
    text: '文本'
  }
  return map[type] || type
}

function formatChatTime(timestamp) {
  if (!timestamp) return ''
  return dayjs(timestamp).format('HH:mm:ss')
}

function mapFailureReason(reason) {
  const text = String(reason || '').toLowerCase()
  if (text.includes('network') || text.includes('网络')) return '网络异常'
  if (text.includes('copyright') || text.includes('版权')) return '版权限制'
  if (text.includes('source') || text.includes('url') || text.includes('音源')) return '无可用音源'
  return reason || '添加失败'
}

async function onGenerate() {
  const text = promptText.value.trim()
  if (!text) {
    message.warning('请输入歌单需求')
    return
  }

  const result = await aiStore.generateFromPrompt(text)
  if (!result.success) {
    message.error(result.error || aiStore.error || '生成失败，请稍后重试')
  }
}

async function onConfirm() {
  const result = await aiStore.createDraftToLocalPlaylist()

  if (result?.success) {
    const addedSongs = Number.isFinite(result.addedSongs)
      ? result.addedSongs
      : draftSongs.value.length
    if (result.partial) {
      const failedCount = Array.isArray(result.failedSongs) ? result.failedSongs.length : 0
      message.warning(`歌单已创建，成功添加 ${addedSongs} 首，失败 ${failedCount} 首`)
      return
    }

    message.success(`已创建本地歌单，成功添加 ${addedSongs} 首歌曲`)
    aiPlaylistStore.closeModal()

    if (result.playlistId) {
      router.push({
        name: ROUTE_NAMES.PLAYLIST_DETAIL,
        params: { id: String(result.playlistId) }
      })
    }
    return
  }

  message.error(result?.error || aiStore.error || '创建本地歌单失败')
}

async function onRetryFailedSongs() {
  const result = await aiStore.retryFailedSongsToLocalPlaylist()
  if (!result?.success) {
    message.error(result?.error || aiStore.error || '重试失败，请稍后再试')
    return
  }

  const failedCount = Array.isArray(result.failedSongs) ? result.failedSongs.length : 0
  if (failedCount > 0) {
    message.warning(`已重试成功 ${result.addedSongs} 首，仍有 ${failedCount} 首失败`)
  } else {
    message.success(`重试成功，已补齐 ${result.addedSongs} 首歌曲`)
  }
}

function onApplyPendingDraft() {
  const success = aiStore.applyPendingDraft()
  if (success) {
    message.success('已应用本次调整草稿')
  }
}

function onRollbackDraft() {
  const success = aiStore.rollbackDraft()
  if (success) {
    message.warning('已回滚到上一个草稿')
  } else {
    message.info('暂无可回滚的草稿')
  }
}
</script>

<style scoped lang="scss">
.ai-playlist-modal {
  :deep(.n-card-header) {
    padding-bottom: 8px;
  }
}

.ai-playlist-modal__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-playlist-modal__prompt {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.session-select {
  width: 180px;
}

.session-rename-input {
  width: 180px;
}

.session-order-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  border: 1px dashed var(--n-border-color);
  border-radius: 8px;
  font-size: 12px;
  color: var(--n-text-color-2);
  background: var(--n-card-color);
  cursor: grab;
}

.session-order-item__title {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-order-item__drag {
  color: var(--n-text-color-3);
}

.ai-playlist-modal__actions-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.provider-mode-select {
  width: 120px;
}

.debug-export-btn {
  margin-right: auto;
}

.ai-playlist-modal__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
}

.section-meta {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.section-empty {
  margin: 0;
  font-size: 13px;
  color: var(--n-text-color-3);
}

.simple-list {
  margin: 0;
  padding-left: 16px;
  color: var(--n-text-color-2);
  font-size: 13px;
  line-height: 1.6;
}

.draft-song-list {
  max-height: 180px;
  overflow: auto;
}

.chat-list {
  max-height: 180px;
  overflow: auto;
  list-style: none;
  padding-left: 0;
}

.chat-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
}

.chat-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-meta-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.chat-item--user {
  background: color-mix(in srgb, var(--n-primary-color) 10%, transparent);
}

.chat-item--assistant {
  background: var(--n-hover-color);
}

.chat-role {
  font-weight: 600;
  color: var(--n-text-color-2);
  flex-shrink: 0;
}

.chat-content {
  color: var(--n-text-color);
  word-break: break-word;

  :deep(p) {
    margin: 0;
  }

  :deep(a) {
    color: var(--n-primary-color);
    text-decoration: none;
  }
}

.chat-time {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.chat-provider {
  font-size: 11px;
  color: var(--n-text-color-3);
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--n-hover-color);
  text-transform: uppercase;
}

.chat-type-tag {
  font-size: 11px;
  color: var(--n-primary-color);
  border: 1px solid color-mix(in srgb, var(--n-primary-color) 35%, transparent);
  border-radius: 999px;
  padding: 1px 6px;
}

.chat-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--n-text-color-2);
}

.ai-playlist-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.pending-adjustment {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed var(--n-primary-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--n-primary-color) 8%, transparent);
}

.pending-adjustment__text {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.pending-adjustment__actions {
  display: flex;
  gap: 8px;
}

.pending-adjustment__intent {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.pending-adjustment__diff {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pending-adjustment__mode {
  display: flex;
  align-items: center;
}

.pending-adjustment__diff-item {
  font-size: 12px;
  color: var(--n-text-color-2);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pending-adjustment__toggle-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-adjustment__quick-actions {
  display: inline-flex;
  gap: 4px;
}

.fail-reason-list {
  color: var(--n-text-color-3);
}

.diff-label {
  color: var(--n-text-color-3);
}

.diff-content {
  color: var(--n-text-color);
}

@media (max-width: 640px) {
  .draft-song-list {
    max-height: 140px;
  }
}
</style>
