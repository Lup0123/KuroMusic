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

      <div class="playlist-content">
        <transition-group name="song-list" tag="div">
          <div
            v-for="(song, index) in playlist"
            :key="song.id || index"
            class="playlist-item"
            :class="{ active: currentSongIndex === index }"
            @click="playSong(index)"
          >
            <div class="song-index">
              <span v-if="currentSongIndex !== index">{{ index + 1 }}</span>
              <n-icon v-else class="playing-icon"><PlayOutline /></n-icon>
            </div>
            <div class="song-info">
              <div class="song-title">{{ song.name }}</div>
              <div class="song-artist">{{ song.artist }}</div>
            </div>
            <div class="song-duration">{{ formatDuration(song.duration) }}</div>
            <div class="song-actions">
              <n-button text circle size="small" title="移除" @click.stop="removeSong(index)">
                <template #icon
                  ><n-icon><CloseOutline /></n-icon
                ></template>
              </n-button>
            </div>
          </div>
        </transition-group>

        <div v-if="playlist.length === 0" class="empty-state">
          <n-icon size="60"><HeadsetOutline /></n-icon>
          <p>播放列表为空</p>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { useDialog, useThemeVars } from 'naive-ui'
import { useSongStore } from '@/stores/songStore'
import { formatDuration } from '@/utils/utils'
import { storeToRefs } from 'pinia'
import { TrashOutline, CloseOutline, PlayOutline, HeadsetOutline } from '@vicons/ionicons5'

const dialog = useDialog()
const themeVars = useThemeVars()
const songStore = useSongStore()
const { playlist, currentSongIndex } = storeToRefs(songStore)

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible'])

const drawerStyle = computed(() => {
  const drawerBg = themeVars.value.cardColor || themeVars.value.bodyColor
  return {
    '--playlist-drawer-bg': drawerBg,
    backgroundColor: drawerBg
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

const clearPlaylist = async () => {
  dialog.warning({
    title: '提示',
    content: '确定要清空播放列表吗?',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
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

.playlist-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 8px;
  margin: 4px 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background: var(--n-primary-color);
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
      color-mix(in srgb, var(--n-primary-color) 16%, transparent) 0%,
      color-mix(in srgb, var(--n-primary-color) 24%, transparent) 100%
    );
    color: var(--n-primary-color);

    &::before {
      height: 60%;
    }

    .song-title {
      color: var(--n-primary-color);
      font-weight: 600;
    }

    .song-index {
      color: var(--n-primary-color);
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

.playlist-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: transparent;
  z-index: 1000;
}

.playlist-drawer {
  --playlist-drawer-bg: var(--n-card-color, var(--n-color, #1f1f1f));
  position: fixed;
  top: 60px;
  right: 0;
  bottom: 80px;
  width: 420px;
  background-color: var(--playlist-drawer-bg) !important;
  box-shadow: -4px 0 24px var(--n-pressed-color);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 16px 0 0 16px;
  overflow: hidden;

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

/* 列表项动�?*/
.song-list-enter-active,
.song-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.song-list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.song-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
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
