<template>
  <div :class="['lyrics-view', `preset-${lyricVisualPreset}`]">
    <!-- 左侧：封面 -->
    <div class="left-section">
      <n-card class="song-cover-card" :bordered="false" content-style="padding: 0">
        <div class="song-cover">
          <n-image :src="currentSong.cover" :preview-disabled="true">
            <template #placeholder>
              <div class="image-error">
                <n-icon :size="60">
                  <ImageOutline />
                </n-icon>
              </div>
            </template>
          </n-image>
        </div>
      </n-card>
    </div>

    <!-- 右侧：歌曲信息和歌词 -->
    <div class="right-section">
      <!-- 主内容区域 -->
      <div class="content-wrapper">
        <!-- 歌曲信息 -->
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <n-space :size="20" class="song-meta">
            <span class="meta-text">专辑: {{ currentSong.album }}</span>
            <n-divider vertical />
            <span class="meta-text">歌手: {{ currentSong.artist }}</span>
          </n-space>
        </div>

        <!-- 歌词模式切换 -->
        <n-radio-group
          :value="lyricMode"
          class="lyric-mode-tabs"
          @update:value="(val) => (lyricMode = val)"
        >
          <n-radio-button value="both">歌词</n-radio-button>
          <n-radio-button value="translation" :disabled="!hasTranslation">译文</n-radio-button>
        </n-radio-group>

        <!-- 歌词容器 -->
        <div ref="scrollbarRef" class="lyrics-scrollbar" @scroll="handleScroll">
          <div class="lyrics-wrapper">
            <n-empty v-if="!hasLyric && !loadingLyric" description="暂无歌词" />
            <n-skeleton v-else-if="loadingLyric" :repeat="10" text />
            <div
              v-for="(line, index) in displayLyrics"
              v-else
              :key="index"
              ref="lyricLineRefs"
              :class="['lyric-line', { active: currentLineIndex === index }]"
              tabindex="0"
              @click="seekToTime(line)"
            >
              <div class="lyric-text" :style="{ fontSize: `${fontSize}px` }">
                {{ line.text }}
              </div>
              <div
                v-if="lyricMode === 'both' && line.translation"
                class="lyric-translation"
                :style="{ fontSize: `${fontSize - 4}px` }"
              >
                {{ line.translation }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧工具栏 -->
      <div class="side-toolbar">
        <!-- 关闭按钮 -->
        <n-button circle size="large" class="close-btn" @click="closeLyric">
          <template #icon>
            <n-icon :size="20">
              <CloseOutline />
            </n-icon>
          </template>
        </n-button>

        <n-divider style="margin: 12px 0" />

        <!-- 字号调整 -->
        <div class="font-size-control">
          <n-button circle size="small" :disabled="fontSize >= 32" @click="increaseFontSize">
            <template #icon>
              <n-icon>
                <AddOutline />
              </n-icon>
            </template>
          </n-button>
          <n-tag type="info" class="size-tag">{{ fontSize }}</n-tag>
          <n-button circle size="small" :disabled="fontSize <= 14" @click="decreaseFontSize">
            <template #icon>
              <n-icon>
                <RemoveOutline />
              </n-icon>
            </template>
          </n-button>
        </div>

        <n-divider style="margin: 12px 0" />

        <!-- 自动滚动开关 -->
        <n-tooltip trigger="hover" placement="left">
          <template #trigger>
            <n-switch
              :value="autoScroll"
              size="small"
              class="auto-scroll-switch"
              @update:value="(checked) => (autoScroll = checked)"
            >
              <template #checked>
                <n-icon :size="14">
                  <CheckmarkOutline />
                </n-icon>
              </template>
              <template #unchecked>
                <n-icon :size="14">
                  <CloseOutline />
                </n-icon>
              </template>
            </n-switch>
          </template>
          自动滚动
        </n-tooltip>

        <n-divider style="margin: 12px 0" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NImage,
  NSpace,
  NDivider,
  NRadioGroup,
  NRadioButton,
  NEmpty,
  NSkeleton,
  NButton,
  NTag,
  NTooltip,
  NSwitch,
  NIcon
} from 'naive-ui'
import {
  CloseOutline,
  AddOutline,
  RemoveOutline,
  ImageOutline,
  CheckmarkOutline
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const songStore = useSongStore()
const { currentSong, currentTime } = storeToRefs(songStore)

const scrollbarRef = ref(null)
const lyricLineRefs = ref([])

// 歌词相关状态
const rawLyrics = ref([])
const rawTranslationLyrics = ref([])
const currentLineIndex = ref(0)
const lyricMode = ref('both')
const loadingLyric = ref(false)
const autoScroll = ref(true)
const userScrolling = ref(false)
const scrollTimer = ref(null)
const lyricsRequestId = ref(0)
const isProgrammaticScroll = ref(false)

const fontSize = ref(20)

// 增加字号
const increaseFontSize = () => {
  if (fontSize.value < 32) {
    fontSize.value += 2
    localStorage.setItem('lyricFontSize', fontSize.value.toString())
  }
}

// 减小字号
const decreaseFontSize = () => {
  if (fontSize.value > 14) {
    fontSize.value -= 2
    localStorage.setItem('lyricFontSize', fontSize.value.toString())
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
  const requestId = ++lyricsRequestId.value

  if (!songId) {
    rawLyrics.value = []
    rawTranslationLyrics.value = []
    currentLineIndex.value = 0
    return
  }

  loadingLyric.value = true

  try {
    const response = await window.api.getSongLyrics(songId)

    if (requestId !== lyricsRequestId.value) {
      return
    }

    if (response.body && response.body.lrc) {
      rawLyrics.value = parseLyric(response.body.lrc.lyric)

      if (response.body.tlyric && response.body.tlyric.lyric) {
        rawTranslationLyrics.value = parseLyric(response.body.tlyric.lyric)
      } else {
        rawTranslationLyrics.value = []
      }
    } else {
      rawLyrics.value = []
      rawTranslationLyrics.value = []
    }
  } catch (error) {
    if (requestId !== lyricsRequestId.value) {
      return
    }

    console.error('加载歌词失败:', error)
    rawLyrics.value = []
    rawTranslationLyrics.value = []
  } finally {
    if (requestId === lyricsRequestId.value) {
      loadingLyric.value = false
    }
  }
}

const mergedLyrics = computed(() => {
  if (!rawLyrics.value.length) {
    return []
  }

  if (!hasTranslation.value) {
    return rawLyrics.value
  }

  const translations = rawTranslationLyrics.value
  let pointer = 0

  return rawLyrics.value.map((line) => {
    while (pointer < translations.length - 1 && translations[pointer + 1].time <= line.time) {
      pointer += 1
    }

    const current = translations[pointer]
    const next = translations[pointer + 1]
    const bestMatch =
      next && Math.abs(next.time - line.time) < Math.abs(current.time - line.time) ? next : current

    const translation =
      bestMatch && Math.abs(bestMatch.time - line.time) <= 0.8 ? bestMatch.text : ''

    return {
      ...line,
      translation
    }
  })
})

// 根据模式显示歌词
const displayLyrics = computed(() => {
  if (lyricMode.value === 'translation' && hasTranslation.value) {
    return rawTranslationLyrics.value
  }

  if (lyricMode.value === 'both' && hasTranslation.value) {
    return mergedLyrics.value
  }

  return rawLyrics.value
})

const findCurrentLyricIndex = (lyrics, time) => {
  let left = 0
  let right = lyrics.length - 1
  let index = 0

  while (left <= right) {
    const middle = Math.floor((left + right) / 2)

    if (lyrics[middle].time <= time) {
      index = middle
      left = middle + 1
    } else {
      right = middle - 1
    }
  }

  return index
}

// 更新当前歌词行
const updateCurrentLine = () => {
  const currentLyrics =
    lyricMode.value === 'translation' && hasTranslation.value
      ? rawTranslationLyrics.value
      : rawLyrics.value

  if (!currentLyrics.length) {
    currentLineIndex.value = 0
    return
  }

  const time = currentTime.value
  const index = findCurrentLyricIndex(currentLyrics, time)

  if (index !== currentLineIndex.value) {
    currentLineIndex.value = index
    if (autoScroll.value && !userScrolling.value) {
      nextTick(() => {
        scrollToCurrentLine()
      })
    }
  }
}

// 滚动到当前歌词行
const scrollToCurrentLine = () => {
  const currentLine = lyricLineRefs.value[currentLineIndex.value]
  const container = scrollbarRef.value

  if (!currentLine || !container) return

  try {
    const containerHeight = container.clientHeight
    const lineOffsetTop = currentLine.offsetTop
    const lineHeight = currentLine.clientHeight

    // 计算滚动位置，使当前行在容器中央
    const targetScrollTop = lineOffsetTop - containerHeight / 1.6 + lineHeight / 2.5

    // 平滑滚动到目标位置
    isProgrammaticScroll.value = true
    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    })

    setTimeout(() => {
      isProgrammaticScroll.value = false
    }, 400)
  } catch (error) {
    isProgrammaticScroll.value = false
    console.error('滚动失败:', error)
  }
}

// 处理滚动
const handleScroll = () => {
  if (!autoScroll.value || isProgrammaticScroll.value) return

  userScrolling.value = true

  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }

  scrollTimer.value = setTimeout(() => {
    userScrolling.value = false
  }, 2000)
}

// 关闭歌词页面
const closeLyric = () => {
  songStore.showLyric = false
  const nextQuery = { ...route.query }
  delete nextQuery.lyric

  router.push({
    name: route.name,
    params: route.params,
    query: nextQuery
  })
}

// 跳转到指定时间
const seekToTime = (line) => {
  if (!line || line.time === undefined) {
    console.error('无效的歌词行:', line)
    return
  }

  const targetTime = line.time
  songStore.setCurrentTime(targetTime)

  if (songStore.audioElement) {
    songStore.audioElement.currentTime = targetTime
  }

  if (!songStore.isPlaying) {
    songStore.togglePlay()
  }

  userScrolling.value = false

  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
    scrollTimer.value = null
  }

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
      userScrolling.value = false
      scrollToCurrentLine()
    }
  },
  { immediate: true }
)

watch(currentTime, updateCurrentLine)

watch(lyricMode, () => {
  userScrolling.value = false
  nextTick(() => {
    updateCurrentLine()
    scrollToCurrentLine()
  })
})

watch(autoScroll, (newValue) => {
  if (newValue) {
    userScrolling.value = false
    nextTick(() => {
      scrollToCurrentLine()
    })
  }
})

const clampFontSize = (size) => {
  if (Number.isNaN(size)) {
    return 20
  }

  return Math.min(32, Math.max(14, size))
}

;(() => {
  const savedFontSize = localStorage.getItem('lyricFontSize')
  if (savedFontSize) {
    fontSize.value = clampFontSize(parseInt(savedFontSize, 10))
  }
})()

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

  .left-section {
    flex: 0 0 45%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }

    .song-cover-card {
      width: 100%;
      max-width: 450px;
      aspect-ratio: 1;
      border-radius: 20px;
      overflow: hidden;
      box-shadow:
        0 16px 48px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(34, 39, 46, 0.12);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      z-index: 1;

      &:hover {
        transform: scale(1.02);
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.4),
          0 0 0 1px rgba(34, 39, 46, 0.12);
      }

      .song-cover {
        width: 100%;
        height: 100%;
        position: relative;

        :deep(.n-image) {
          width: 100%;
          height: 100%;
          border-radius: 20px;

          img {
            object-fit: cover;
            width: 100%;
            height: 100%;
          }

          &.rotating img {
            animation: rotate 20s linear infinite;
          }
        }

        .image-error {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(24, 160, 88, 0.08);
          color: #7b8290;
        }
      }
    }
  }

  .right-section {
    flex: 1;
    display: flex;
    border-left: 1px solid rgba(34, 39, 46, 0.12);
    overflow: hidden;

    .content-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 24px 32px;
      overflow: hidden;

      .song-info {
        flex-shrink: 0;
        margin-bottom: 16px;

        .song-title {
          font-size: 30px;
          font-weight: 700;
          margin: 0 0 12px 0;
        }

        .song-meta {
          .meta-text {
            color: #7b8290;
            font-size: 14px;
          }

          :deep(.n-divider) {
            background-color: rgba(34, 39, 46, 0.12);
          }
        }
      }

      .lyric-mode-tabs {
        background: rgba(24, 160, 88, 0.08);
        border-radius: 10px;
        display: inline-flex;
        width: fit-content;

        :deep(.n-radio-button) {
          background: transparent;
          border: none;
          color: #7b8290;
          border-radius: 8px;
          padding: 2px 20px;
          transition: all 0.3s ease;

          &:hover:not(.n-radio-button--disabled) {
            color: #3f4854;
            background: rgba(24, 160, 88, 0.16);
          }

          &.n-radio-button--checked {
            color: #18a058;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            font-weight: 600;
          }

          &.n-radio-button--disabled {
            opacity: 0.4;
          }
        }
      }

      .lyrics-scrollbar {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        scroll-behavior: smooth;

        &::-webkit-scrollbar {
          width: 6px;
        }

        &::-webkit-scrollbar-track {
          background: rgba(24, 160, 88, 0.08);
          border-radius: 3px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(24, 160, 88, 0.16);
          border-radius: 3px;

          &:hover {
            background: #18a058;
          }
        }

        .lyrics-wrapper {
          padding: 0 0 40% 0;
          min-height: 100%;

          :deep(.n-empty) {
            color: #7b8290;
          }

          .lyric-line {
            text-align: left;
            opacity: 0.52;
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 14px 20px;
            margin: 6px 0;
            border-radius: 8px;
            user-select: none;
            position: relative;
            max-width: 96%;
            outline: none;

            &::before {
              content: '';
              position: absolute;
              left: 0;
              top: 50%;
              transform: translateY(-50%);
              width: 3px;
              height: 0;
              border-radius: 0 2px 2px 0;
              transition: height 0.3s ease;
            }

            .lyric-text {
              display: block;
              line-height: 1.85;
              font-weight: 400;
              transition: all 0.3s ease;
              text-wrap: pretty;
            }

            .lyric-translation {
              display: block;
              line-height: 1.6;
              margin-top: 6px;
              transition: all 0.3s ease;
              text-wrap: pretty;
            }

            &:hover {
              opacity: 0.8;
              background: rgba(24, 160, 88, 0.08);
              transform: translateX(3px);
            }

            &:focus-visible {
              opacity: 0.9;
              background: rgba(24, 160, 88, 0.08);
              box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.3);
            }

            &.active {
              opacity: 1;
              background: linear-gradient(
                90deg,
                rgba(99, 125, 255, 0.08) 0%,
                rgba(99, 125, 255, 0.12) 100%
              );

              &::before {
                height: 60%;
              }

              .lyric-text {
                font-weight: 650;
                color: #18a058;
                transform: scale(1.05);
                transform-origin: left center;
                text-shadow: 0 0 18px rgba(99, 125, 255, 0.15);
              }

              .lyric-translation {
                opacity: 0.9;
                color: #3f4854;
                transform: scale(1.02);
                transform-origin: left center;
              }
            }
          }
        }
      }
    }

    .side-toolbar {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 20px 12px;
      gap: 8px;
      border-left: 1px solid rgba(34, 39, 46, 0.12);
      width: auto;
      min-width: 80px;

      .close-btn {
        margin-bottom: 8px;

        &:hover {
          background: rgba(208, 48, 80, 0.1);
          border-color: #d03050;
          color: #d03050;
        }
      }

      :deep(.n-divider) {
        width: 100%;
        min-width: 40px;
        background-color: rgba(34, 39, 46, 0.12);
      }

      .font-size-control {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;

        :deep(.n-button) {
          background: transparent;
          border: 1px solid rgba(34, 39, 46, 0.12);
          color: #7b8290;
          transition: all 0.3s ease;

          &:hover:not(.n-button--disabled) {
            background: rgba(24, 160, 88, 0.08);
            color: #18a058;
            border-color: #18a058;
          }

          &.n-button--disabled {
            opacity: 0.3;
          }
        }

        .size-tag {
          border: 1px solid rgba(34, 39, 46, 0.12);
          color: #3f4854;
          font-weight: 600;
          padding: 4px 8px;
          font-size: 12px;
        }
      }

      .auto-scroll-switch {
        :deep(.n-switch) {
          &.n-switch--active {
            background-color: #18a058;
          }
        }
      }

      .preset-toggle-btn {
        width: 28px;
        height: 28px;
        min-width: 28px;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid rgba(34, 39, 46, 0.12);
        color: #3f4854;
        background: #ffffff;
        transition: all 0.3s ease;

        &:hover {
          color: #18a058;
          border-color: #18a058;
          background: rgba(24, 160, 88, 0.08);
        }
      }
    }
  }
}

@media (max-width: 1200px) {
  .lyrics-view {
    .left-section {
      flex: 0 0 40%;
      padding: 40px;
    }
  }
}

@media (max-width: 768px) {
  .lyrics-view {
    flex-direction: column;

    .left-section {
      flex: 0 0 auto;
      padding: 24px;

      .song-cover-card {
        max-width: 300px;
      }
    }

    .right-section {
      border-left: none;
      border-top: 1px solid rgba(34, 39, 46, 0.12);
      flex-direction: column;

      .content-wrapper {
        padding: 18px 16px;

        .song-info {
          margin-bottom: 12px;

          .song-title {
            font-size: 24px;
          }
        }

        .lyrics-scrollbar {
          .lyrics-wrapper {
            padding: 0 0 28% 0;

            .lyric-line {
              margin: 4px 0;
              border-radius: 6px;
            }
          }
        }
      }

      .side-toolbar {
        border-left: none;
        border-top: 1px solid rgba(34, 39, 46, 0.12);
        flex-direction: row;
        min-width: auto;
        width: auto;
        height: auto;
        gap: 12px;
        padding: 12px 20px;

        .close-btn {
          margin-bottom: 0;
        }

        :deep(.n-divider) {
          display: none;
        }

        .font-size-control {
          flex-direction: row;
          gap: 4px;
        }

        .preset-toggle-btn {
          width: 26px;
          height: 26px;
          min-width: 26px;
        }
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .lyrics-view {
    .left-section {
      .song-cover-card {
        transition: none;

        &:hover {
          transform: none;
        }
      }
    }

    .right-section {
      .content-wrapper {
        .lyrics-scrollbar {
          scroll-behavior: auto;

          .lyrics-wrapper {
            .lyric-line {
              transition: none;

              &:hover {
                transform: none;
              }

              &.active {
                .lyric-text,
                .lyric-translation {
                  transform: none;
                  text-shadow: none;
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
