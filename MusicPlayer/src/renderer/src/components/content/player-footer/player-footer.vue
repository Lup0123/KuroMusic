<template>
  <el-footer height="80px" class="player-footer">
    <div class="player-container">
      <!-- 当前播放歌曲信息 -->
      <div class="current-song">
        <el-avatar :size="50" :src="currentSong.cover" shape="square" />
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <div class="song-artist">{{ currentSong.artist }}</div>
        </div>
        <el-button type="text" size="small">
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

        <div class="progress-container">
          <span class="time-current">{{ formattedCurrentTime }}</span>
          <el-slider
            :model-value="progress"
            @update:model-value="handleProgressChange"
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

    <!-- 隐藏的音频元素 - 修改这里：移除 :src，改为在 watch 中动态设置 -->
    <audio
      ref="audioRef"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="handleEnded"
      @error="handleError"
      crossorigin="anonymous"
      preload="metadata"
    />
  </el-footer>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSongStore } from '@/stores/songStore'
import { ElMessage } from 'element-plus'

const songStore = useSongStore()
const { currentSong, isPlaying, progress, volume, formattedCurrentTime, formattedDuration } =
  storeToRefs(songStore)

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
// 防止重复触发播放的标志
const isLoadingNewSong = ref(false)

// 监听播放状态变化
watch(isPlaying, async (newVal) => {
  // 如果正在加载新歌曲,跳过
  if (isLoadingNewSong.value) {
    console.log('⏳ 正在加载新歌曲,跳过播放状态监听')
    return
  }

  if (!audioRef.value || !currentSong.value.path) {
    console.log('⚠️ audioRef 或歌曲路径不存在')
    return
  }

  try {
    if (newVal) {
      // 播放
      console.log('▶️ 准备播放:', currentSong.value.path)
      await audioRef.value.play()
      console.log('✅ 播放成功')
    } else {
      // 暂停
      audioRef.value.pause()
      console.log('⏸️ 暂停播放')
    }
  } catch (error) {
    console.error('❌ 播放失败:', error)
    ElMessage.error(`播放失败: ${error.message}`)
    songStore.isPlaying = false
  }
})

// 监听当前歌曲变化
watch(
  () => currentSong.value.path,
  async (newPath, oldPath) => {
    console.log('🎵 歌曲路径变化:', {
      old: oldPath,
      new: newPath,
      currentSong: currentSong.value
    })

    if (!newPath) {
      console.warn('⚠️ 新歌曲路径为空')
      return
    }

    if (!audioRef.value) {
      console.error('❌ audioRef 不存在')
      return
    }

    if (newPath === oldPath) {
      console.log('✅ 路径未改变，跳过')
      return
    }

    // 设置加载标志
    isLoadingNewSong.value = true
    const shouldAutoPlay = isPlaying.value

    try {
      // 暂停当前播放
      audioRef.value.pause()
      console.log('⏸️ 暂停当前播放')

      // 重置播放状态
      songStore.isPlaying = false

      // 设置新的音频源 - 关键：直接设置 src
      console.log('🔄 设置新音频源:', newPath)
      audioRef.value.src = newPath

      // 重新加载新歌曲
      audioRef.value.load()
      console.log('🔄 开始加载音频')

      // 等待元数据加载完成
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('⏱️ 加载超时')
          reject(new Error('加载超时'))
        }, 10000)

        audioRef.value.onloadedmetadata = () => {
          console.log('✅ 元数据加载完成')
          console.log('音频时长:', audioRef.value.duration)
          clearTimeout(timeout)
          resolve()
        }

        audioRef.value.onerror = (e) => {
          clearTimeout(timeout)
          reject(new Error('加载失败'))
        }
      })

      // 如果之前是播放状态,自动播放新歌曲
      if (shouldAutoPlay) {
        await audioRef.value.play()
        songStore.isPlaying = true
      }
    } catch (error) {
      ElMessage.error(`加载失败: ${error.message}`)
      songStore.isPlaying = false
    } finally {
      // 清除加载标志
      isLoadingNewSong.value = false
    }
  },
  { immediate: false }
)

// 监听音量变化
watch(volume, (newVolume) => {
  if (audioRef.value) {
    audioRef.value.volume = newVolume / 100
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
    console.log('📊 元数据加载完成，时长:', audioRef.value.duration)
    setDuration(audioRef.value.duration)
  }
}

const handleEnded = () => {
  console.log('✅ 歌曲播放完毕')
  playNext()
}

const handleError = (e) => {
  console.error('❌ 音频加载错误:', {
    error: e,
    src: e.target?.src,
    networkState: e.target?.networkState,
    readyState: e.target?.readyState,
    currentSong: currentSong.value
  })

  if (e.target?.error) {
    const errorCodes = {
      1: 'MEDIA_ERR_ABORTED - 用户中止',
      2: 'MEDIA_ERR_NETWORK - 网络错误',
      3: 'MEDIA_ERR_DECODE - 解码错误',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 不支持的格式或URL'
    }
    console.error('详细错误:', {
      code: e.target.error.code,
      message: errorCodes[e.target.error.code] || e.target.error.message
    })
  }

  ElMessage.error('音频加载失败，请检查网络或歌曲链接')
  songStore.isPlaying = false
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

// 初始化音量
onMounted(() => {
  console.log('🎵 播放器组件已挂载')
  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100
    console.log('🔊 初始音量:', volume.value)
  }
})
</script>

<style lang="scss" scoped>
@import './player-footer.scss';

audio {
  display: none;
}
</style>
