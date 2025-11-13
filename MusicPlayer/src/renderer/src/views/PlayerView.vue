<template>
  <div class="lyrics-view">
    <!-- 左侧：封面 -->
    <div class="left-section">
      <el-card class="song-cover-card" :body-style="{ padding: '0' }">
        <div class="song-cover">
          <el-image :src="currentSong.cover" fit="cover" :class="{ rotating: false }">
            <template #error>
              <div class="image-error">
                <el-icon :size="60"><Picture /></el-icon>
              </div>
            </template>
          </el-image>
        </div>
      </el-card>
    </div>

    <!-- 右侧：歌曲信息和歌词 -->
    <div class="right-section">
      <!-- 歌曲信息 -->
      <div class="song-info">
        <h1 class="song-title">{{ currentSong.name }}</h1>
        <el-space :size="20" class="song-meta">
          <el-text type="info">专辑: {{ currentSong.album }}</el-text>
          <el-divider direction="vertical" />
          <el-text type="info">歌手: {{ currentSong.artist }}</el-text>
        </el-space>
      </div>

      <!-- 歌词模式切换 -->
      <el-radio-group v-model="lyricMode" class="lyric-mode-tabs">
        <el-radio-button label="both">歌词</el-radio-button>
        <el-radio-button label="translation" :disabled="!hasTranslation">译文</el-radio-button>
      </el-radio-group>

      <!-- 歌词容器 -->
      <el-scrollbar
        ref="scrollbarRef"
        class="lyrics-scrollbar"
        @scroll="handleScroll"
        :native="false"
      >
        <div class="lyrics-wrapper">
          <el-empty v-if="!hasLyric && !loadingLyric" description="暂无歌词" :image-size="100" />
          <el-skeleton v-else-if="loadingLyric" :rows="10" animated />
          <div
            v-else
            v-for="(line, index) in displayLyrics"
            :key="index"
            ref="lyricLineRefs"
            :class="['lyric-line', { active: currentLineIndex === index }]"
            @click="seekToTime(line)"
          >
            <el-text class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
              {{ line.text }}
            </el-text>
            <el-text
              v-if="lyricMode === 'both' && line.translation"
              class="lyric-translation"
              type="info"
              :style="{ fontSize: `${fontSize - 3}px` }"
            >
              {{ line.translation }}
            </el-text>
          </div>
        </div>
      </el-scrollbar>

      <!-- 工具栏 -->
      <div class="toolbar">
        <!-- 字号调整 -->
        <el-space :size="8" class="font-size-control">
          <el-button
            circle
            size="small"
            :disabled="fontSize <= 14"
            @click="decreaseFontSize"
            :icon="Minus"
          >
          </el-button>
          <el-tag type="info" effect="plain" size="small">{{ fontSize }}px</el-tag>
          <el-button
            circle
            size="small"
            :disabled="fontSize >= 32"
            @click="increaseFontSize"
            :icon="Plus"
          >
          </el-button>
        </el-space>

        <!-- 自动滚动开关 -->
        <el-tooltip content="自动滚动" placement="bottom">
          <el-switch
            v-model="autoScroll"
            size="small"
            inline-prompt
            active-text="自动"
            inactive-text="手动"
          />
        </el-tooltip>

        <!-- 关闭按钮 -->
        <el-button circle @click="closeLyric" :icon="Close" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Close, Plus, Minus, Picture } from '@element-plus/icons-vue'

const router = useRouter()
const songStore = useSongStore()
const { currentSong, isPlaying, currentTime } = storeToRefs(songStore)

const scrollbarRef = ref(null)
const lyricLineRefs = ref([])

// 歌词相关状态
const rawLyrics = ref([])
const rawTranslationLyrics = ref([])
const currentLineIndex = ref(0)
const translateY = ref(0)
const lyricMode = ref('both') // 'both', 'translation'
const loadingLyric = ref(false)
const autoScroll = ref(true)
const userScrolling = ref(false)
const scrollTimer = ref(null)

// 字号控制
const fontSize = ref(18) // 默认字号

// 增加字号
const increaseFontSize = () => {
  if (fontSize.value < 32) {
    fontSize.value += 2
    localStorage.setItem('lyricFontSize', fontSize.value.toString())
    ElMessage.success(`字号: ${fontSize.value}px`)
  }
}

// 减小字号
const decreaseFontSize = () => {
  if (fontSize.value > 14) {
    fontSize.value -= 2
    localStorage.setItem('lyricFontSize', fontSize.value.toString())
    ElMessage.success(`字号: ${fontSize.value}px`)
  }
}

// 计算属性
const hasLyric = computed(() => rawLyrics.value.length > 0)
const hasTranslation = computed(() => rawTranslationLyrics.value.length > 0)

// 解析歌词文本
const parseLyric = (lyricText) => {
  if (!lyricText) return []

  const lines = lyricText.split('\n')
  const lyricArray = []

  lines.forEach((line) => {
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

  loadingLyric.value = true

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

      if (rawTranslationLyrics.value.length > 0) {
        console.log('翻译歌词加载成功:', rawTranslationLyrics.value.length, '行')
      }
    } else {
      rawLyrics.value = []
      rawTranslationLyrics.value = []
    }
  } catch (error) {
    rawLyrics.value = []
    rawTranslationLyrics.value = []
  } finally {
    loadingLyric.value = false
  }
}

// 根据模式显示歌词
const displayLyrics = computed(() => {
  if (lyricMode.value === 'translation' && hasTranslation.value) {
    return rawTranslationLyrics.value
  }

  if (lyricMode.value === 'both' && hasTranslation.value) {
    // 合并原文和翻译
    return rawLyrics.value.map((line, index) => ({
      ...line,
      translation: rawTranslationLyrics.value[index]?.text || ''
    }))
  }

  return rawLyrics.value
})

// 更新当前歌词行
const updateCurrentLine = () => {
  const currentLyrics =
    lyricMode.value === 'translation' && hasTranslation.value
      ? rawTranslationLyrics.value
      : rawLyrics.value

  if (!currentLyrics.length) return

  const time = currentTime.value
  let index = 0

  // 查找当前时间对应的歌词行
  for (let i = 0; i < currentLyrics.length; i++) {
    if (time >= currentLyrics[i].time) {
      index = i
    } else {
      break
    }
  }

  if (index !== currentLineIndex.value) {
    currentLineIndex.value = index
    // 如果自动滚动开启且用户没有手动滚动，则自动滚动
    if (autoScroll.value && !userScrolling.value) {
      nextTick(() => {
        scrollToCurrentLine()
      })
    }
  }
}

// 滚动到当前歌词行 - 优化滚动效果
const scrollToCurrentLine = () => {
  const scrollbar = scrollbarRef.value
  const currentLine = lyricLineRefs.value[currentLineIndex.value]

  if (!scrollbar || !currentLine) return

  try {
    // 获取滚动容器和当前行的位置信息
    const wrapElement = scrollbar.wrapRef
    const containerHeight = wrapElement.clientHeight
    const lineOffsetTop = currentLine.offsetTop
    const lineHeight = currentLine.clientHeight

    // 计算目标滚动位置，使当前行居中
    const targetScrollTop = lineOffsetTop - containerHeight / 2 + lineHeight / 2

    // 使用 scrollbar 的 setScrollTop 方法平滑滚动
    scrollbar.setScrollTop(targetScrollTop)
  } catch (error) {
    console.error('滚动失败:', error)
    // 降级方案
    currentLine.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
}

// 处理滚动 - 优化用户滚动检测
const handleScroll = () => {
  if (!autoScroll.value) return

  // 标记用户正在手动滚动
  userScrolling.value = true

  // 清除之前的定时器
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }

  // 2秒后恢复自动滚动
  scrollTimer.value = setTimeout(() => {
    userScrolling.value = false
    // 恢复自动滚动后立即滚动到当前行
    nextTick(() => {
      scrollToCurrentLine()
    })
  }, 2000)
}

// 关闭歌词页面
const closeLyric = () => {
  songStore.showLyric = false
  router.push('/')
}

// 跳转到指定时间 - 修复点击跳转
const seekToTime = (line) => {
  if (!line || line.time === undefined) {
    console.error('无效的歌词行:', line)
    return
  }

  const targetTime = line.time

  console.log('跳转到时间:', targetTime, '秒')

  // 使用 action 方法更新时间
  songStore.setCurrentTime(targetTime)

  // 如果有音频元素，同步更新播放进度
  if (songStore.audioElement) {
    songStore.audioElement.currentTime = targetTime
  }

  // 如果当前没有播放，开始播放
  if (!songStore.isPlaying) {
    songStore.togglePlay()
  }

  // 暂停用户滚动状态，允许自动滚动
  userScrolling.value = false

  // 清除滚动定时器
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
    scrollTimer.value = null
  }

  // 立即更新当前行并滚动
  nextTick(() => {
    updateCurrentLine()
    scrollToCurrentLine()
  })
}

// 监听当前歌曲变化
watch(
  () => currentSong.value?.id,
  (newId) => {
    if (newId) {
      loadLyrics(newId)
      currentLineIndex.value = 0
      translateY.value = 0
      userScrolling.value = false
      // 重置歌词模式
      lyricMode.value = 'both'
    }
  },
  { immediate: true }
)

// 监听播放时间 - 优化更新频率
watch(currentTime, updateCurrentLine)

// 监听歌词模式变化
watch(lyricMode, () => {
  currentLineIndex.value = 0
  userScrolling.value = false
  nextTick(() => {
    updateCurrentLine()
    scrollToCurrentLine()
  })
})

// 监听自动滚动开关
watch(autoScroll, (newValue) => {
  if (newValue) {
    // 开启自动滚动时立即滚动到当前行
    userScrolling.value = false
    nextTick(() => {
      scrollToCurrentLine()
    })
  }
})

onMounted(() => {
  if (currentSong.value?.id) {
    loadLyrics(currentSong.value.id)
  }
  // 从本地存储恢复字号设置
  const savedFontSize = localStorage.getItem('lyricFontSize')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize)
  }
})

onUnmounted(() => {
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }
})
</script>

<style scoped lang="scss">
.lyrics-view {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: #1a1a1a;

  // 左侧封面区域
  .left-section {
    flex: 0 0 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a1a;
    padding: 60px;

    .song-cover-card {
      width: 100%;
      max-width: 500px;
      aspect-ratio: 1;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      background: transparent;
      border: none;

      .song-cover {
        width: 100%;
        height: 100%;
        position: relative;

        :deep(.el-image) {
          width: 100%;
          height: 100%;
          border-radius: 12px;

          &.rotating {
            animation: rotate 20s linear infinite;
          }

          img {
            object-fit: cover;
          }
        }

        .image-error {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.3);
        }
      }
    }
  }

  // 右侧内容区域
  .right-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #252525;
    color: #fff;
    position: relative;
    padding: 40px;

    .song-info {
      margin-bottom: 30px;

      .song-title {
        font-size: 32px;
        font-weight: 600;
        margin: 0 0 16px 0;
        color: #fff;
      }

      .song-meta {
        :deep(.el-text) {
          color: rgba(255, 255, 255, 0.6);
        }

        :deep(.el-divider) {
          background-color: rgba(255, 255, 255, 0.2);
        }
      }
    }

    .lyric-mode-tabs {
      margin-bottom: 30px;

      :deep(.el-radio-button__inner) {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        border-bottom: 2px solid transparent;
        border-radius: 0;
        padding: 12px 24px;
        transition: all 0.3s;

        &:hover {
          color: rgba(255, 255, 255, 0.8);
        }
      }

      :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
        color: #fff;
        background: transparent;
        border-bottom-color: #fff;
        box-shadow: none;
      }

      :deep(.is-disabled .el-radio-button__inner) {
        opacity: 0.3;
      }
    }

    .lyrics-scrollbar {
      flex: 1;
      height: 0;

      :deep(.el-scrollbar__view) {
        padding: 20px 0;
      }

      .lyrics-wrapper {
        transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);

        .lyric-line {
          text-align: left;
          opacity: 0.3;
          cursor: pointer;
          transition: all 0.4s;
          padding: 12px 0;
          user-select: none;

          .lyric-text {
            display: block;
            line-height: 1.8;
            font-weight: 400;
            color: #fff;
            transition: all 0.3s;
          }

          .lyric-translation {
            display: block;
            line-height: 1.6;
            margin-top: 6px;
            transition: all 0.3s;
          }

          &:hover {
            opacity: 0.6;
          }

          &.active {
            opacity: 1;

            .lyric-text {
              font-weight: 500;
              transform: scale(1.15);
              transform-origin: left center;
            }

            .lyric-translation {
              opacity: 0.8;
              transform: scale(1.15);
              transform-origin: left center;
            }
          }
        }
      }
    }

    .toolbar {
      position: absolute;
      top: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 12px;

      .font-size-control {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 20px;
        padding: 4px 12px;

        :deep(.el-button) {
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: rgba(255, 255, 255, 0.6);

          &:hover:not(.is-disabled) {
            background: rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.9);
          }

          &.is-disabled {
            opacity: 0.3;
          }
        }

        :deep(.el-tag) {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
        }
      }

      :deep(.el-switch) {
        --el-switch-on-color: #409eff;
        --el-switch-off-color: rgba(255, 255, 255, 0.2);
      }

      > :deep(.el-button) {
        background: rgba(255, 255, 255, 0.05);
        border: none;
        color: rgba(255, 255, 255, 0.6);

        &:hover {
          background: rgba(255, 255, 255, 0.15);
          color: rgba(255, 255, 255, 0.9);
        }
      }
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
