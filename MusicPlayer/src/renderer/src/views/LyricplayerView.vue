<template>
  <div class="lyric-player-container">
    <!-- 左侧：封面和歌曲信息 -->
    <div class="left-section">
      <div class="cover-wrapper">
        <el-image
          :src="currentSong?.cover || 'https://via.placeholder.com/400'"
          fit="cover"
          class="song-cover-large"
        >
          <template #error>
            <div class="image-error">
              <el-icon :size="80"><Picture /></el-icon>
            </div>
          </template>
        </el-image>
      </div>

      <div class="song-info-bottom">
        <h2 class="song-name">{{ currentSong?.name || '暂无播放' }}</h2>
        <p class="song-meta">
          <span class="artist">{{ currentSong?.artist || '未知歌手' }}</span>
          <span class="separator">·</span>
          <span class="album">{{ currentSong?.album || '未知专辑' }}</span>
        </p>
      </div>
    </div>

    <!-- 右侧：歌词区域 -->
    <div class="right-section">
      <!-- 顶部控制栏 -->
      <div class="lyric-header">
        <div class="tabs">
          <button :class="{ active: lyricMode === 'original' }" @click="lyricMode = 'original'">
            歌词
          </button>
          <button
            :class="{ active: lyricMode === 'translation' }"
            @click="lyricMode = 'translation'"
            :disabled="!hasTranslation"
          >
            译文
          </button>
          <button
            :class="{ active: lyricMode === 'both' }"
            @click="lyricMode = 'both'"
            :disabled="!hasTranslation"
          >
            双语
          </button>
        </div>

        <div class="actions">
          <el-button :icon="Setting" circle @click="showSettings = true" />
        </div>
      </div>

      <!-- 歌词内容 -->
      <div class="lyric-content">
        <LyricPlayer
          ref="lyricPlayer"
          :currentTime="currentTime * 1000"
          class="lyric-player"
          :lyric-lines="displayLyrics"
          @line-click="jumpTime"
        />

        <div v-if="!hasLyric" class="no-lyric">
          <el-icon :size="60"><Document /></el-icon>
          <p>暂无歌词</p>
        </div>
      </div>
    </div>

    <!-- 设置抽屉 -->
    <el-drawer v-model="showSettings" title="歌词设置" size="400px">
      <div class="settings-content">
        <el-form label-position="left" label-width="100px">
          <el-form-item label="字体大小">
            <el-slider v-model="fontSize" :min="14" :max="40" :step="2" show-stops />
          </el-form-item>

          <el-form-item label="行间距">
            <el-slider v-model="lineHeight" :min="1.5" :max="3" :step="0.1" show-stops />
          </el-form-item>

          <el-form-item label="自动滚动">
            <el-switch v-model="autoScroll" />
          </el-form-item>

          <el-divider />

          <el-button type="primary" @click="resetSettings">恢复默认</el-button>
        </el-form>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture, Document, Setting } from '@element-plus/icons-vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { BackgroundRender, LyricPlayer } from '@applemusic-like-lyrics/vue'

const songStore = useSongStore()
const { currentSong, currentTime, isPlaying } = storeToRefs(songStore)

// 原始歌词数据
const rawLyrics = ref([])
const rawTranslationLyrics = ref([])
const currentLineIndex = ref(0)
const lyricContainer = ref(null)
const lyricLineRefs = ref([])
const translateY = ref(0)

// 歌词显示模式
const lyricMode = ref('original') // 'original', 'translation', 'both'

// 歌词设置
const showSettings = ref(false)
const fontSize = ref(20)
const lineHeight = ref(2)
const textAlign = ref('center')
const autoScroll = ref(true)
const blurEffect = ref(true)
const userScrolling = ref(false)
const scrollTimer = ref(null)

// 计算属性
const hasLyric = computed(() => rawLyrics.value.length > 0)
const hasTranslation = computed(() => rawTranslationLyrics.value.length > 0)

// 计算偏白的主题色（用于歌词颜色）
const lightMainColor = computed(() => {
  // 你可以根据当前歌曲的主题色动态计算
  // 这里暂时使用一个默认值
  const r = 255
  const g = 255
  const b = 255
  return `rgba(${r}, ${g}, ${b}, 0.9)`
})

// 格式化歌词为 LyricLine 接口格式
const lyrics = computed(() => {
  if (!rawLyrics.value.length) return []

  return rawLyrics.value.map((line, index) => {
    const nextLine = rawLyrics.value[index + 1]
    const endTime = nextLine ? nextLine.time * 1000 : (line.time + 5) * 1000

    // 根据模式决定是否包含翻译
    let translatedLyric = ''
    if (lyricMode.value === 'both' && rawTranslationLyrics.value[index]) {
      translatedLyric = rawTranslationLyrics.value[index].text
    }

    // 构造符合 LyricLine 接口的数据
    return {
      words: [
        {
          word: line.text,
          startTime: line.time * 1000,
          endTime: endTime,
          romanWord: '',
          obscene: false
        }
      ],
      translatedLyric: translatedLyric,
      romanLyric: '',
      startTime: line.time * 1000,
      endTime: endTime,
      isBG: false,
      isDuet: false
    }
  })
})

// 仅显示翻译的歌词
const translationOnlyLyrics = computed(() => {
  if (!rawTranslationLyrics.value.length) return []

  return rawTranslationLyrics.value.map((line, index) => {
    const nextLine = rawTranslationLyrics.value[index + 1]
    const endTime = nextLine ? nextLine.time * 1000 : (line.time + 5) * 1000

    return {
      words: [
        {
          word: line.text,
          startTime: line.time * 1000,
          endTime: endTime,
          romanWord: '',
          obscene: false
        }
      ],
      translatedLyric: '',
      romanLyric: '',
      startTime: line.time * 1000,
      endTime: endTime,
      isBG: false,
      isDuet: false
    }
  })
})

// 根据模式返回对应的歌词
const displayLyrics = computed(() => {
  if (lyricMode.value === 'translation') {
    return translationOnlyLyrics.value
  }
  return lyrics.value
})

// 解析歌词文本
const parseLyric = (lyricText) => {
  if (!lyricText) return []

  const lines = lyricText.split('\n')
  const lyricArray = []

  lines.forEach((line) => {
    // 匹配时间标签 [00:00.00]
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g
    const matches = [...line.matchAll(timeRegex)]

    if (matches.length > 0) {
      const text = line.replace(timeRegex, '').trim()
      if (text) {
        matches.forEach((match) => {
          const minutes = parseInt(match[1])
          const seconds = parseInt(match[2])
          const milliseconds = parseInt(match[3].padEnd(3, '0'))
          const time = minutes * 60 + seconds + milliseconds / 1000

          lyricArray.push({ time, text })
        })
      }
    }
  })

  return lyricArray.sort((a, b) => a.time - b.time)
}

// 加载歌词
const loadLyrics = async (songId) => {
  if (!songId) {
    rawLyrics.value = []
    rawTranslationLyrics.value = []
    return
  }

  try {
    const response = await window.api.getSongLyrics(songId)

    if (response.body && response.body.lrc) {
      rawLyrics.value = parseLyric(response.body.lrc.lyric)

      // 加载翻译歌词
      if (response.body.tlyric && response.body.tlyric.lyric) {
        rawTranslationLyrics.value = parseLyric(response.body.tlyric.lyric)
      } else {
        rawTranslationLyrics.value = []
      }

      console.log('歌词加载成功:', rawLyrics.value.length, '行')
      if (rawTranslationLyrics.value.length > 0) {
        console.log('翻译歌词加载成功:', rawTranslationLyrics.value.length, '行')
      }
    } else {
      rawLyrics.value = []
      rawTranslationLyrics.value = []
      console.log('无歌词数据')
    }
  } catch (error) {
    console.error('加载歌词失败:', error)
    ElMessage.error('加载歌词失败')
    rawLyrics.value = []
    rawTranslationLyrics.value = []
  }
}

// 更新当前歌词行
const updateCurrentLine = () => {
  if (!rawLyrics.value.length) return

  const time = currentTime.value
  let index = 0

  for (let i = 0; i < rawLyrics.value.length; i++) {
    if (time >= rawLyrics.value[i].time) {
      index = i
    } else {
      break
    }
  }

  if (index !== currentLineIndex.value) {
    currentLineIndex.value = index
    if (autoScroll.value && !userScrolling.value) {
      scrollToCurrentLine()
    }
  }
}

// 滚动到当前歌词行
const scrollToCurrentLine = () => {
  if (!lyricContainer.value || !lyricLineRefs.value[currentLineIndex.value]) return

  const container = lyricContainer.value
  const currentLine = lyricLineRefs.value[currentLineIndex.value]

  if (currentLine) {
    const containerHeight = container.clientHeight
    const lineOffsetTop = currentLine.offsetTop
    const lineHeight = currentLine.clientHeight

    // 计算需要滚动的距离,使当前行居中
    translateY.value = containerHeight / 2 - lineOffsetTop - lineHeight / 2
  }
}

// 跳转到指定时间
const jumpTime = (e) => {
  if (songStore.audioElement) {
    songStore.audioElement.currentTime = e.line.getLine().startTime / 1000
  }
}

// 处理鼠标滚轮
const handleWheel = () => {
  userScrolling.value = true

  // 清除之前的定时器
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }

  // 3秒后恢复自动滚动
  scrollTimer.value = setTimeout(() => {
    userScrolling.value = false
  }, 3000)
}

// 重置设置
const resetSettings = () => {
  fontSize.value = 20
  lineHeight.value = 2
  textAlign.value = 'center'
  autoScroll.value = true
  blurEffect.value = true
  ElMessage.success('已恢复默认设置')
}

// 监听当前歌曲变化
watch(
  () => currentSong.value?.id,
  (newId) => {
    if (newId) {
      loadLyrics(newId)
      currentLineIndex.value = 0
      translateY.value = 0
    }
  },
  { immediate: true }
)

// 监听播放时间
watch(currentTime, updateCurrentLine)

// 监听歌词模式变化
watch(lyricMode, () => {
  nextTick(() => {
    scrollToCurrentLine()
  })
})

onMounted(() => {
  if (currentSong.value?.id) {
    loadLyrics(currentSong.value.id)
  }
})

onUnmounted(() => {
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }
})
</script>

<style scoped lang="scss">
.lyric-player-container {
  width: 100%;
  height: 100%;
  display: flex;
  background: #fafafa;
  overflow: hidden;

  html.dark & {
    background: #121212;
  }

  // 左侧区域
  .left-section {
    flex: 0 0 45%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px;
    background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);

    html.dark & {
      background: linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%);
    }

    .cover-wrapper {
      width: 100%;
      max-width: 400px;
      aspect-ratio: 1;
      margin-bottom: 40px;

      .song-cover-large {
        width: 100%;
        height: 100%;
        border-radius: 16px;
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.15),
          0 8px 20px rgba(0, 0, 0, 0.08);
        transition: transform 0.3s ease;

        &:hover {
          transform: scale(1.02);
        }

        html.dark & {
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .image-error {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          background: #f5f7fa;
          color: #909399;

          html.dark & {
            background: #2c2c2c;
            color: #6c6c6c;
          }
        }
      }
    }

    .song-info-bottom {
      text-align: center;
      width: 100%;
      max-width: 400px;

      .song-name {
        margin: 0 0 12px;
        font-size: 28px;
        font-weight: 700;
        color: #303133;
        line-height: 1.3;

        html.dark & {
          color: #e5e5e5;
        }
      }

      .song-meta {
        margin: 0;
        font-size: 15px;
        color: #606266;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;

        html.dark & {
          color: #a8a8a8;
        }

        .separator {
          color: #909399;

          html.dark & {
            color: #7c7c7c;
          }
        }
      }
    }
  }

  // 右侧歌词区域
  .right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #ffffff;

    html.dark & {
      background: #1e1e1e;
    }

    .lyric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 40px;
      border-bottom: 1px solid #e4e7ed;

      html.dark & {
        border-bottom: 1px solid #414243;
      }

      .tabs {
        display: flex;
        gap: 4px;

        button {
          padding: 8px 20px;
          border: none;
          background: transparent;
          color: #606266;
          font-size: 14px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;

          html.dark & {
            color: #a8a8a8;
          }

          &:hover:not(:disabled) {
            background: #f5f7fa;

            html.dark & {
              background: #2c2c2c;
            }
          }

          &.active {
            background: #409eff;
            color: #ffffff;
            font-weight: 600;

            html.dark & {
              background: #529fff;
            }
          }

          &:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }
        }
      }
    }

    .lyric-content {
      flex: 1;
      position: relative;
      overflow: hidden;
      padding: 0 20px;
      margin: 80px 0 0 0;
      mask: linear-gradient(
        rgba(255, 255, 255, 0) 0px,
        rgba(255, 255, 255, 0.6) 5%,
        rgb(255, 255, 255) 10%,
        rgb(255, 255, 255) 75%,
        rgba(255, 255, 255, 0.6) 85%,
        rgba(255, 255, 255, 0)
      );

      :deep(.lyric-player) {
        --amll-lyric-view-color: v-bind(lightMainColor);
        font-family: 'lyricfont';
        --amll-lyric-player-font-size: min(2.6vw, 39px);
        height: 100%;

        * [class*='lyricMainLine'] {
          font-weight: 600 !important;
          text-align: right !important;
          padding-right: 60px !important;

          * {
            font-weight: 600 !important;
          }
        }

        * [class*='lyricLine']:not([class*='lyricMainLine']) {
          text-align: right !important;
          padding-right: 60px !important;
        }

        * [class*='lyricTranslation'] {
          text-align: right !important;
          padding-right: 60px !important;
          font-size: 24px !important;
          margin-top: 8px !important;
        }

        & > div {
          padding-bottom: 0;
          overflow: hidden;
          transform: translateY(-20px);
        }
      }

      .no-lyric {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #c0c4cc;

        html.dark & {
          color: #606266;
        }

        p {
          margin-top: 12px;
          font-size: 15px;
        }
      }
    }
  }

  .settings-content {
    padding: 20px;

    .el-form-item {
      margin-bottom: 24px;
    }
  }
}
</style>
