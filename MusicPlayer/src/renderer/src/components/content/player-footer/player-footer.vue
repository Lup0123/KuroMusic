<template>
  <n-layout-footer class="player-footer" :style="{ height: '80px' }">
    <div class="player-container">
      <!-- 当前播放歌曲信息 -->
      <div class="current-song" @click="goToLyric">
        <n-image
          :width="50"
          :height="50"
          :src="currentSong.cover"
          :preview-disabled="true"
          object-fit="cover"
          style="border-radius: 4px; pointer-events: none"
        />
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <div class="song-artist">{{ currentSong.artist }}</div>
        </div>
        <n-button text size="small" @click.stop>
          <template #icon
            ><n-icon><StarOutline /></n-icon
          ></template>
        </n-button>
      </div>

      <!-- 播放控制 -->
      <div class="player-controls">
        <div class="control-buttons">
          <n-button text size="large" @click="playPrevious">
            <template #icon
              ><n-icon size="20"><PlaySkipBackOutline /></n-icon
            ></template>
          </n-button>
          <n-button type="primary" circle size="large" @click="togglePlay">
            <template #icon>
              <n-icon size="20">
                <PlayOutline v-if="!isPlaying" />
                <PauseOutline v-else />
              </n-icon>
            </template>
          </n-button>
          <n-button text size="large" @click="playNext">
            <template #icon
              ><n-icon size="20"><PlaySkipForwardOutline /></n-icon
            ></template>
          </n-button>
        </div>

        <!-- 进度条 -->
        <div class="progress-container" @click="goToLyric">
          <span class="time-current">{{ formattedCurrentTime }}</span>
          <n-slider
            :value="progress"
            :tooltip="false"
            class="progress-slider"
            @update:value="handleProgressChange"
            @click.stop
          />
          <span class="time-total">{{ formattedDuration }}</span>
        </div>
      </div>

      <!-- 右侧功能 -->
      <div class="player-actions">
        <n-button text size="large">
          <template #icon
            ><n-icon><RepeatOutline /></n-icon
          ></template>
        </n-button>
        <n-button text size="large" @click="togglePlaylist">
          <template #icon
            ><n-icon><ListOutline /></n-icon
          ></template>
        </n-button>
        <n-button text size="large" :loading="isDownloading" @click="handleDownload">
          <template #icon
            ><n-icon><DownloadOutline /></n-icon
          ></template>
        </n-button>
        <n-button text size="large" @click="goToLyric">
          <template #icon
            ><n-icon><DocumentTextOutline /></n-icon
          ></template>
        </n-button>
        <div class="volume-control">
          <n-icon size="20"><VolumeHighOutline /></n-icon>
          <n-slider
            :value="volume"
            :tooltip="false"
            style="width: 80px; margin-left: 8px"
            @update:value="handleVolumeChange"
          />
        </div>
      </div>
    </div>

    <audio
      ref="audioRef"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="handleEnded"
      @error="handleError"
    />
  </n-layout-footer>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSongStore } from '@/stores/songStore'
import { useMessage } from 'naive-ui'
import {
  StarOutline,
  PlaySkipBackOutline,
  PlayOutline,
  PauseOutline,
  PlaySkipForwardOutline,
  RepeatOutline,
  ListOutline,
  DownloadOutline,
  DocumentTextOutline,
  VolumeHighOutline
} from '@vicons/ionicons5'
import { downloadSong } from '@/utils/downloadUtils'

const router = useRouter()
const message = useMessage()
const songStore = useSongStore()
const {
  currentSong,
  isPlaying,
  progress,
  volume,
  formattedCurrentTime,
  formattedDuration,
  currentTime
} = storeToRefs(songStore)
const {
  togglePlay,
  playNext,
  playPrevious,
  togglePlaylist,
  setCurrentTime,
  setDuration,
  setVolume,
  setProgress
} = songStore

const audioRef = ref(null)
const isDownloading = ref(false)

const handleDownload = async () => {
  if (!currentSong.value.id) {
    message.warning('当前没有播放歌曲')
    return
  }
  isDownloading.value = true
  try {
    await downloadSong(currentSong.value)
  } finally {
    isDownloading.value = false
  }
}

const goToLyric = () => {
  if (!currentSong.value.id) {
    message.warning('当前没有播放歌曲')
    return
  }
  const currentRoute = router.currentRoute.value
  const nextQuery = { ...currentRoute.query }
  if (nextQuery.lyric === '1') delete nextQuery.lyric
  else nextQuery.lyric = '1'
  router.push({ name: currentRoute.name, params: currentRoute.params, query: nextQuery })
}

watch(isPlaying, (newVal) => {
  if (!audioRef.value) return
  if (newVal) audioRef.value.play().catch((err) => console.error('播放失败:', err))
  else audioRef.value.pause()
})

watch(
  () => currentSong.value.id,
  async (newId, oldId) => {
    if (!newId || newId === '' || newId === oldId) return
    try {
      let songUrl = null
      if (currentSong.value.url) songUrl = currentSong.value.url
      else if (currentSong.value.path) songUrl = currentSong.value.path
      else {
        const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
        const quality = settings.quality || 'exhigh'
        const response = await window.api.getSongUrl(newId, quality)
        if (response?.body?.data?.[0]) songUrl = response.body.data[0].url
      }
      if (songUrl && audioRef.value) {
        audioRef.value.src = songUrl
        audioRef.value.load()
        if (isPlaying.value) await audioRef.value.play()
      } else {
        message.error('无法获取歌曲播放地址')
        songStore.isPlaying = false
      }
    } catch (error) {
      console.error('加载歌曲失败:', error)
      message.error('歌曲加载失败')
      songStore.isPlaying = false
    }
  },
  { immediate: true }
)

watch(volume, (newVolume) => {
  if (audioRef.value) audioRef.value.volume = newVolume / 100
})
watch(currentTime, (newTime) => {
  if (!audioRef.value) return
  if (Math.abs(audioRef.value.currentTime - newTime) > 0.5) audioRef.value.currentTime = newTime
})

const handleTimeUpdate = () => {
  if (audioRef.value) setCurrentTime(audioRef.value.currentTime)
}
const handleLoadedMetadata = () => {
  if (audioRef.value) setDuration(audioRef.value.duration)
}
const handleEnded = () => {
  playNext()
}
const handleError = (e) => {
  console.error('音频加载错误:', e)
  message.error('音频加载失败，尝试播放下一首')
  songStore.isPlaying = false
  setTimeout(() => playNext(), 1000)
}
const handleProgressChange = (value) => {
  setProgress(value)
  if (audioRef.value?.duration) audioRef.value.currentTime = (value / 100) * audioRef.value.duration
}
const handleVolumeChange = (value) => {
  setVolume(value)
}

onMounted(() => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100
    songStore.audioElement = audioRef.value
  }
})
</script>

<style lang="scss" scoped>
// 播放器底部样式
.player-footer {
  background: var(--n-card-color);
  border-top: 1px solid var(--n-border-color);
  padding: 0;
  height: 80px;
  box-shadow: 0 -2px 12px var(--n-hover-color);
  backdrop-filter: blur(10px);

  .player-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    padding: 0 24px;
    gap: 24px;
  }
}

// 当前播放歌曲信息样式
.current-song {
  display: flex;
  align-items: center;
  width: 25%;
  min-width: 250px;
  gap: 12px;

  .song-cover {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 12px var(--n-pressed-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px var(--n-pressed-color);
    }

    :deep(.ant-image) {
      width: 100%;
      height: 100%;
    }
  }

  .song-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .song-title {
      font-weight: 600;
      font-size: 15px;
      color: var(--n-text-color-2);
      margin: 0 0 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition:
        color 0.3s ease,
        transform 0.2s ease;

      &:hover {
        color: var(--n-text-color);
      }
    }

    .song-artist {
      font-size: 12px;
      color: var(--n-text-color-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;

      &:hover {
        color: var(--n-text-color-2);
      }
    }
  }

  .song-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover .song-actions {
    opacity: 1;
  }
}

// 播放控制区域
.player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 50%;
  min-width: 400px;
  gap: 2px;

  .control-buttons {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.ant-btn) {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: scale(1.1);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    :deep(.ant-btn-primary) {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      box-shadow: 0 4px 12px var(--n-primary-color);

      &:hover {
        box-shadow: 0 6px 16px var(--color-primary-light-4);
        transform: scale(1.15);
      }
    }
  }

  .progress-container {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;

    .time-current,
    .time-total {
      font-size: 12px;
      color: var(--n-text-color-3);
      width: 45px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }

    .progress-slider {
      flex: 1;
      min-width: 200px;

      :deep(.ant-slider-track) {
        background: var(--n-primary-color);
      }

      :deep(.ant-slider-btn) {
        width: 14px;
        height: 14px;
        border: 1px solid var(--n-card-color);
        transition: all 0.3s ease;

        &:hover {
          transform: scale(1.05);
        }
      }
    }
  }
}

// 右侧功能区
.player-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 25%;
  min-width: 200px;
  gap: 12px;

  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 120px;

    :deep(.ant-btn) {
      transition: all 0.3s ease;

      &:hover {
        transform: scale(1.1);
      }
    }

    .volume-slider {
      flex: 1;
      min-width: 80px;

      :deep(.ant-slider-track) {
        background: var(--n-primary-color);
      }

      :deep(.ant-slider-btn) {
        width: 12px;
        height: 12px;
        border: 2px solid var(--n-card-color);
      }
    }
  }

  :deep(.ant-btn) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.1);
    }

    &.active {
      color: var(--n-primary-color);
      background: color-mix(in srgb, var(--n-primary-color) 16%, transparent);
    }
  }
}

// 响应式设计
@media (max-width: 1200px) {
  .player-footer {
    .player-container {
      padding: 0 16px;
    }
  }

  .current-song,
  .player-actions {
    width: 20%;
    min-width: 180px;
  }

  .player-controls {
    width: 60%;
  }
}

@media (max-width: 768px) {
  .player-footer {
    height: auto;
    padding: 12px 0;

    .player-container {
      flex-direction: column;
      gap: 12px;
    }
  }

  .current-song,
  .player-controls,
  .player-actions {
    width: 100%;
    min-width: 0;
  }

  .volume-control {
    display: none;
  }
}

// 播放动画
@keyframes playing {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

.playing-animation {
  display: flex;
  gap: 2px;

  span {
    width: 3px;
    height: 14px;
    background: var(--n-primary-color);
    border-radius: 2px;
    animation: playing 0.8s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

audio {
  display: none;
}
.current-song {
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
  }
}
.progress-container {
  cursor: pointer;
}
</style>