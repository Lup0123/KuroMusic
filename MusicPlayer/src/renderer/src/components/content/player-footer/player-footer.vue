<template>
  <a-layout-footer class="player-footer" :style="{ height: '80px' }">
    <div class="player-container">
      <!-- 当前播放歌曲信息 -->
      <div class="current-song" @click="goToLyric">
        <a-image
          :width="50"
          :height="50"
          :src="currentSong.cover"
          style="border-radius: 4px; pointer-events: none"
          preview="false"
        />
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <div class="song-artist">{{ currentSong.artist }}</div>
        </div>
        <a-button type="text" size="small" @click.stop>
          <template #icon>
            <icon-star />
          </template>
        </a-button>
      </div>

      <!-- 播放控制 -->
      <div class="player-controls">
        <div class="control-buttons">
          <a-button type="text" size="large" @click="playPrevious">
            <template #icon>
              <icon-skip-previous />
            </template>
          </a-button>
          <a-button type="primary" shape="circle" size="large" @click="togglePlay">
            <template #icon>
              <icon-play-arrow v-if="!isPlaying" />
              <icon-pause v-else />
            </template>
          </a-button>
          <a-button type="text" size="large" @click="playNext">
            <template #icon>
              <icon-skip-next />
            </template>
          </a-button>
        </div>

        <!-- 进度条 -->
        <div class="progress-container" @click="goToLyric">
          <span class="time-current">{{ formattedCurrentTime }}</span>
          <a-slider
            :model-value="progress"
            @update:model-value="handleProgressChange"
            @click.stop
            :show-tooltip="false"
            class="progress-slider"
          />
          <span class="time-total">{{ formattedDuration }}</span>
        </div>
      </div>

      <!-- 右侧功能 -->
      <div class="player-actions">
        <a-button type="text" size="large">
          <template #icon>
            <icon-refresh size="30" />
          </template>
        </a-button>
        <a-button type="text" size="large" @click="togglePlaylist">
          <template #icon>
            <icon-list size="30" />
          </template>
        </a-button>
        <a-button type="text" size="large" @click="handleDownload" :loading="isDownloading">
          <template #icon>
            <icon-download size="30" />
          </template>
        </a-button>
        <a-button type="text" size="large" @click="goToLyric">
          <template #icon>
            <icon-file size="30" />
          </template>
        </a-button>
        <div class="volume-control">
          <icon-sound-fill style="color: rgb(var(--primary-6))" />
          <a-slider
            v-model="volume"
            @update:model-value="handleVolumeChange"
            :show-tooltip="false"
            style="width: 80px; margin-left: 8px"
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
  </a-layout-footer>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSongStore } from '@/stores/songStore'
import { Message } from '@arco-design/web-vue'
import {
  IconStar,
  IconSkipPrevious,
  IconPlayArrow,
  IconPause,
  IconSkipNext,
  IconRefresh,
  IconList,
  IconDownload,
  IconFile,
  IconSoundFill
} from '@arco-design/web-vue/es/icon'
import { downloadSong } from '@/utils/downloadUtils'

const router = useRouter()
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
    Message.warning('当前没有播放歌曲')
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
    Message.warning('当前没有播放歌曲')
    return
  }
  // 切换歌词页：如果已在歌词页则关闭，否则打开
  if (router.currentRoute.value.name === 'Lyric') {
    router.push('/')
  } else {
    router.push({ name: 'Lyric' })
  }
}

// 监听播放状态变化
watch(isPlaying, (newVal) => {
  if (!audioRef.value) return
  if (newVal) {
    audioRef.value.play().catch((err) => {
      console.error('播放失败:', err)
    })
  } else {
    audioRef.value.pause()
  }
})

// 监听当前歌曲变化,加载新的音频
watch(
  () => currentSong.value.id,
  async (newId, oldId) => {
    // 检查 newId 是否为有效值
    if (!newId || newId === '' || newId === oldId) return

    try {
      let songUrl = null

      // 判断是否为本地音乐（有 path 或 url 字段且指向本地文件）
      if (currentSong.value.url) {
        // 如果已有 url 字段，直接使用（本地音乐）
        songUrl = currentSong.value.url
        console.log('使用本地文件路径:', songUrl)
      } else if (currentSong.value.path) {
        // 如果有 path 字段，说明是本地音乐
        songUrl = currentSong.value.path
        console.log('使用本地文件路径:', songUrl)
      } else {
        // 在线音乐，调用 API 获取播放 URL
        // 从设置中获取音质
        const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
        const settingQuality = settings.quality || 'exhigh'
        // 映射音质设置到 API 支持的格式
        const qualityMap = {
          standard: 'standard', // 标准品质 128kbps
          higher: 'higher', // 较高品质 192kbps
          exhigh: 'exhigh', // 极高品质 320kbps
          lossless: 'lossless', // 无损品质 FLAC
          hires: 'hires' // Hi-Res 高解析度
        }
        const quality = qualityMap[settingQuality] || 'exhigh'

        console.log('获取在线歌曲URL:', newId, '音质:', quality)
        const response = await window.api.getSongUrl(newId, quality)

        // 检查返回的数据结构
        if (response && response.body && response.body.data && response.body.data[0]) {
          songUrl = response.body.data[0].url
          console.log('获取到在线歌曲URL:', songUrl)
        }
      }

      if (songUrl && audioRef.value) {
        audioRef.value.src = songUrl
        audioRef.value.load()

        if (isPlaying.value) {
          await audioRef.value.play()
        }
      } else {
        console.error('无法获取歌曲URL', {
          currentSong: currentSong.value,
          songUrl
        })
        Message.error('无法获取歌曲播放地址')
        songStore.isPlaying = false
      }
    } catch (error) {
      console.error('加载歌曲失败:', error)
      Message.error('歌曲加载失败')
      songStore.isPlaying = false
    }
  },
  { immediate: true }
)

// 监听音量变化
watch(volume, (newVolume) => {
  if (audioRef.value) {
    audioRef.value.volume = newVolume / 100
  }
})

// 监听进度变化(拖动进度条时)
watch(currentTime, (newTime) => {
  if (!audioRef.value) return
  const timeDiff = Math.abs(audioRef.value.currentTime - newTime)
  // 只有差异大于 0.5 秒时才更新,避免循环更新
  if (timeDiff > 0.5) {
    audioRef.value.currentTime = newTime
  }
})

// 音频播放时更新当前时间
const handleTimeUpdate = () => {
  if (audioRef.value) {
    setCurrentTime(audioRef.value.currentTime)
  }
}

// 音频元数据加载完成
const handleLoadedMetadata = () => {
  if (audioRef.value) {
    setDuration(audioRef.value.duration)
  }
}

// 音频播放结束
const handleEnded = () => {
  playNext()
}

// 音频加载错误
const handleError = (e) => {
  console.error('音频加载错误:', e)
  console.error('当前音频 src:', audioRef.value?.src)
  console.error('当前歌曲:', currentSong.value)

  Message.error('音频加载失败,尝试播放下一首')

  // 修改5: 重置播放状态
  songStore.isPlaying = false

  // 自动播放下一首
  setTimeout(() => {
    playNext()
  }, 1000)
}

// 拖动进度条
const handleProgressChange = (value) => {
  setProgress(value)
  if (audioRef.value && audioRef.value.duration) {
    audioRef.value.currentTime = (value / 100) * audioRef.value.duration
  }
}

// 调整音量
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
@import './player-footer.scss';

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
