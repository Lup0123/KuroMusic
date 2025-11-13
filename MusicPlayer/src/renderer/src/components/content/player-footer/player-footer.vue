<template>
  <el-footer height="80px" class="player-footer">
    <div class="player-container">
      <!-- 当前播放歌曲信息 - 添加点击事件 -->
      <div class="current-song" @click="goToLyric">
        <el-avatar :size="50" :src="currentSong.cover" shape="square" />
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <div class="song-artist">{{ currentSong.artist }}</div>
        </div>
        <el-button type="text" size="small" @click.stop>
          <el-icon><Star /></el-icon>
        </el-button>
      </div>

      <!-- 播放控制 -->
      <div class="player-controls">
        <div class="control-buttons">
          <el-button type="text" size="large" @click="playPrevious">
            <el-icon><DArrowLeft /></el-icon>
          </el-button>
          <el-button type="primary" circle size="large" @click="togglePlay">
            <el-icon>
              <VideoPlay v-if="!isPlaying" />
              <VideoPause v-else />
            </el-icon>
          </el-button>
          <el-button type="text" size="large" @click="playNext">
            <el-icon><DArrowRight /></el-icon>
          </el-button>
        </div>

        <!-- 进度条 - 添加点击事件 -->
        <div class="progress-container" @click="goToLyric">
          <span class="time-current">{{ formattedCurrentTime }}</span>
          <el-slider
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
        <el-button type="text" size="small">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button type="text" size="small" @click="togglePlaylist">
          <el-icon><List /></el-icon>
        </el-button>
        <!-- 添加歌词按钮 -->
        <el-button type="text" size="small" @click="goToLyric">
          <el-icon><Document /></el-icon>
        </el-button>
        <div class="volume-control">
          <el-icon><Volume /></el-icon>
          <el-slider
            v-model="volume"
            @update:model-value="handleVolumeChange"
            :show-tooltip="false"
            style="width: 80px; margin-left: 8px"
          />
        </div>
      </div>
    </div>

    <!-- 隐藏的音频元素 -->
    <audio
      ref="audioRef"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="handleEnded"
      @error="handleError"
    />
  </el-footer>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSongStore } from '@/stores/songStore'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'

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

// 音频元素引用
const audioRef = ref(null)

// 跳转到歌词页面
const goToLyric = () => {
  if (!currentSong.value.id) {
    ElMessage.warning('当前没有播放歌曲')
    return
  }
  router.push({ name: 'Lyric' })
}

// 监听播放状态变化
watch(isPlaying, (newVal) => {
  if (!audioRef.value) return

  if (newVal) {
    audioRef.value.play()
  } else {
    audioRef.value.pause()
  }
})

// 监听当前歌曲变化
watch(
  () => currentSong.value.path,
  (newPath) => {
    if (newPath && audioRef.value) {
      audioRef.value.src = newPath
      audioRef.value.load()
      if (isPlaying.value) {
        audioRef.value.play()
      }
    }
  }
)

// 监听音量变化
watch(volume, (newVolume) => {
  if (audioRef.value) {
    audioRef.value.volume = newVolume / 100
  }
})

// 监听 store 中的 currentTime 变化（歌词页面点击跳转时触发）
watch(currentTime, (newTime) => {
  if (!audioRef.value) return

  const timeDiff = Math.abs(audioRef.value.currentTime - newTime)

  // 如果时间差超过 0.5 秒，说明是外部跳转（比如点击歌词），需要同步
  if (timeDiff > 0.5) {
    audioRef.value.currentTime = newTime
  }
})

// 音频事件处理
const handleTimeUpdate = () => {
  if (audioRef.value) {
    setCurrentTime(audioRef.value.currentTime)
  }
}

const handleLoadedMetadata = () => {
  if (audioRef.value) {
    setDuration(audioRef.value.duration)
  }
}

const handleEnded = () => {
  playNext()
}

const handleError = (e) => {
  console.error('音频加载错误:', e)
  ElMessage.error('音频加载失败')
}

const handleProgressChange = (value) => {
  setProgress(value)
  if (audioRef.value && audioRef.value.duration) {
    audioRef.value.currentTime = (value / 100) * audioRef.value.duration
  }
}

const handleVolumeChange = (value) => {
  setVolume(value)
}

// 初始化音量和注册 audioElement
onMounted(() => {
  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100
    // 将 audio 元素注册到 store 中，供歌词页面使用
    songStore.audioElement = audioRef.value
  }
})
</script>

<style lang="scss" scoped>
@import './player-footer.scss';

audio {
  display: none;
}

// 添加鼠标悬停效果
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
