<template>
  <transition name="fade">
    <div
      v-show="props.visible"
      class="playlist-overlay"
      :style="overlayStyle"
      @click="closePlaylist"
    ></div>
  </transition>

  <transition name="slide">
    <div v-show="props.visible" class="playlist-drawer" :style="drawerStyle" @click.stop>
      <div class="playlist-header">
        <h3>播放列表</h3>
        <div class="playlist-stats">
          <span>共 {{ playlist.length }} 首</span>
        </div>
        <div class="playlist-actions">
          <n-button text title="批量管理" @click="toggleSelectMode">
            <template #icon
              ><n-icon><CheckboxOutline /></n-icon
            ></template>
          </n-button>
          <n-button text title="清空播放列表" @click="clearPlaylist">
            <template #icon
              ><n-icon><TrashOutline /></n-icon
            ></template>
          </n-button>
          <n-button text title="关闭" @click="closePlaylist">
            <template #icon
              ><n-icon><CloseOutline /></n-icon
            ></template>
          </n-button>
        </div>
      </div>

      <div ref="scrollContainerRef" class="playlist-content">
        <div
          v-if="playlist.length > 0"
          class="playlist-render-layer"
          :style="{ height: `${virtualizerTotalSize}px` }"
        >
          <div
            v-for="item in virtualRowItems"
            :key="item.song.id || item.row.index"
            class="playlist-item virtual-row"
            :class="{
              active: currentSongIndex === item.row.index,
              selected: selectedIds.has(item.song.id)
            }"
            :style="{ transform: `translateY(${item.row.start}px)` }"
            @click="selectMode ? toggleSelect(item.song) : playSong(item.row.index)"
          >
            <div class="song-index">
              <n-checkbox
                v-if="selectMode"
                :checked="selectedIds.has(item.song.id)"
                @click.stop
                @update:checked="toggleSelect(item.song)"
              />
              <span v-else-if="currentSongIndex !== item.row.index">{{ item.row.index + 1 }}</span>
              <n-icon v-else class="playing-icon"><PlayOutline /></n-icon>
            </div>
            <div class="song-info">
              <div class="song-title">{{ item.song.name }}</div>
              <div class="song-artist">{{ item.song.artist }}</div>
            </div>
            <div class="song-duration">{{ formatDuration(item.song.duration) }}</div>
            <div class="song-actions">
              <n-button
                v-if="!selectMode"
                text
                circle
                size="small"
                title="移除"
                aria-label="从队列移除"
                @click.stop="removeSong(item.row.index)"
              >
                <template #icon
                  ><n-icon><CloseOutline /></n-icon
                ></template>
              </n-button>
            </div>
          </div>
        </div>

        <div v-if="playlist.length === 0" class="empty-state">
          <n-icon size="60"><HeadsetOutline /></n-icon>
          <p>播放列表为空</p>
        </div>
      </div>

      <div v-if="selectMode" class="playlist-select-bar">
        <span class="select-count">已选 {{ selectedIds.size }} 首</span>
        <n-button
          size="small"
          type="primary"
          :disabled="selectedIds.size === 0"
          @click="removeSelected"
          >移除选中</n-button
        >
        <n-button size="small" @click="toggleSelectMode">取消</n-button>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useDialog, useMessage } from 'naive-ui'
import { useSongStore } from '@/stores/songStore'
import { formatDuration } from '@/utils/utils'
import { storeToRefs } from 'pinia'
import {
  TrashOutline,
  CloseOutline,
  PlayOutline,
  HeadsetOutline,
  CheckboxOutline
} from '@vicons/ionicons5'

const dialog = useDialog()
const message = useMessage()
const songStore = useSongStore()
const { playlist, currentSongIndex } = storeToRefs(songStore)
const selectMode = ref(false)
const selectedIds = ref(new Set())

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible'])

// 播放队列可能很长，使用虚拟列表只渲染可视区域的行
const scrollContainerRef = ref(null)
const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: playlist.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => 76,
    overscan: 8,
    enabled: props.visible
  }))
)
const virtualRowItems = computed(() =>
  rowVirtualizer.value
    .getVirtualItems()
    .map((row) => ({ row, song: playlist.value[row.index] }))
    .filter((item) => Boolean(item.song))
)
const virtualizerTotalSize = computed(() => rowVirtualizer.value.getTotalSize())

const drawerStyle = computed(() => {
  const glass = 'var(--glass-panel-bg, rgba(24, 26, 32, 0.86))'
  return {
    '--playlist-drawer-bg': glass,
    backgroundColor: glass
  }
})

const overlayStyle = computed(() => ({
  backgroundColor: 'transparent'
}))

const closePlaylist = () => {
  emit('update:visible', false)
}
const playSong = (index) => {
  songStore.currentSongIndex = index
  songStore.setPlaying(true)
}

const removeSong = (index) => {
  songStore.removeFromPlaylist(index)
}

const toggleSelectMode = () => {
  selectMode.value = !selectMode.value
  selectedIds.value = new Set()
}

const toggleSelect = (song) => {
  if (!song?.id) return
  const next = new Set(selectedIds.value)
  if (next.has(song.id)) next.delete(song.id)
  else next.add(song.id)
  selectedIds.value = next
}

const removeSelected = () => {
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return
  dialog.warning({
    title: '提示',
    content: `确定要移除选中的 ${ids.length} 首歌曲吗?`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      songStore.removeSongsByIds(ids)
      toggleSelectMode()
      message.success(`已移除 ${ids.length} 首歌曲`)
    }
  })
}

const clearPlaylist = async () => {
  dialog.warning({
    title: '提示',
    content: '确定要清空播放列表吗?',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      toggleSelectMode()
      playlist.value = []
      songStore.currentSongIndex = -1
      songStore.setPlaying(false)
      songStore.persistPlaybackState()
    }
  })
}
</script>

<style lang="scss" scoped>
.playlist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background-color: var(--playlist-drawer-bg, var(--n-color));
  border-bottom: 1px solid var(--n-border-color);

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--n-text-color);
  }

  .playlist-stats {
    flex: 1;
    margin-left: 12px;
    font-size: 13px;
    color: var(--n-text-color-3);
  }

  .playlist-actions {
    display: flex;
    gap: 8px;
  }
}

.playlist-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
  background-color: var(--playlist-drawer-bg, var(--n-color));

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--n-pressed-color);
    border-radius: 3px;

    &:hover {
      background: var(--n-pressed-color);
    }
  }
}

.playlist-render-layer {
  position: relative;
  width: 100%;
}

.playlist-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 8px;
  margin: 4px 12px;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &.virtual-row {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background: var(--primary-color, var(--n-primary-color));
    border-radius: 0 2px 2px 0;
    transition: height 0.3s ease;
  }

  &:hover {
    background-color: var(--n-hover-color);
    transform: translateX(4px);

    .song-actions {
      opacity: 1;
    }
  }

  &.active {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 16%, transparent) 0%,
      color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 24%, transparent) 100%
    );
    color: var(--primary-color, var(--n-primary-color));

    &::before {
      height: 60%;
    }

    .song-title {
      color: var(--primary-color, var(--n-primary-color));
      font-weight: 600;
    }

    .song-index {
      color: var(--primary-color, var(--n-primary-color));
    }
  }

  &.selected {
    background-color: color-mix(in srgb, var(--primary-color, var(--n-primary-color)) 20%, transparent);

    .song-title {
      color: var(--primary-color, var(--n-primary-color));
      font-weight: 600;
    }
  }

  .song-index {
    width: 40px;
    text-align: center;
    font-size: 14px;
    color: var(--n-text-color-3);
    flex-shrink: 0;

    .playing-icon {
      font-size: 18px;
      animation: pulse 1.5s ease-in-out infinite;
    }
  }

  .song-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    margin-right: 12px;

    .song-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--n-text-color);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-artist {
      font-size: 12px;
      color: var(--n-text-color-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .song-duration {
    font-size: 13px;
    color: var(--n-text-color-3);
    margin-right: 8px;
    flex-shrink: 0;
  }

  .song-actions {
    opacity: 0;
    transition: opacity 0.3s ease;
    flex-shrink: 0;
  }
}

.playlist-select-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid var(--n-border-color);
  background-color: var(--playlist-drawer-bg, var(--n-color));

  .select-count {
    flex: 1;
    font-size: 13px;
    color: var(--n-text-color-3);
  }
}

.playlist-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  z-index: 2500;
}

.playlist-drawer {
  --playlist-drawer-bg: var(--glass-panel-bg, rgba(24, 26, 32, 0.86));
  position: fixed;
  top: 60px;
  right: 0;
  bottom: 80px;
  width: 420px;
  background-color: var(--playlist-drawer-bg) !important;
  backdrop-filter: blur(28px) saturate(150%);
  border-left: 1px solid var(--glass-panel-border, rgba(255, 255, 255, 0.1));
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
  z-index: 2501;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 16px 0 0 16px;
  overflow: hidden;
  color: var(--n-text-color);

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--n-text-color-3);

    svg {
      margin-bottom: 16px;
      color: var(--n-text-color-disabled);
    }

    p {
      font-size: 14px;
      margin: 0;
    }
  }
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.song-list-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 播放图标动画 */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

@media (max-width: 768px) {
  .playlist-drawer {
    width: 100%;
    border-radius: 0;
  }
}
</style>
