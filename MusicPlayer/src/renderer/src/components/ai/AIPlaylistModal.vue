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
        <n-input
          v-model:value="promptText"
          type="textarea"
          placeholder="例如：想要一份适合夜跑的中文流行与电子混合歌单"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
        <div class="ai-playlist-modal__actions-row">
          <n-button type="primary" :loading="aiStore.loading" @click="onGenerate">
            生成推荐
          </n-button>
        </div>
      </div>

      <n-alert v-if="aiStore.error" type="error" :show-icon="false">
        {{ aiStore.error }}
      </n-alert>

      <n-spin :show="aiStore.loading">
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
      </n-spin>
    </div>

    <template #footer>
      <div class="ai-playlist-modal__footer">
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
import { useMessage } from 'naive-ui'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'

const aiPlaylistStore = useAiPlaylistStore()
const aiStore = aiPlaylistStore
const message = useMessage()

const promptText = computed({
  get: () => aiStore.prompt,
  set: (value) => aiStore.setPrompt(value)
})

const draftSongs = computed(() => aiStore.draftPlaylist?.songs || [])

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
    message.success(`已创建本地歌单，成功添加 ${addedSongs} 首歌曲`)
    aiPlaylistStore.closeModal()
    return
  }

  message.error(result?.error || aiStore.error || '创建本地歌单失败')
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

.ai-playlist-modal__actions-row {
  display: flex;
  justify-content: flex-end;
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

.ai-playlist-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 640px) {
  .draft-song-list {
    max-height: 140px;
  }
}
</style>
