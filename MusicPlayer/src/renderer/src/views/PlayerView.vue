<template>
  <div :class="['lyrics-view', `preset-${lyricVisualPreset}`]">
    <!-- 左侧：封面 -->
    <div class="left-section">
      <a-card class="song-cover-card" :bordered="false" :body-style="{ padding: '0' }">
        <div class="song-cover">
          <a-image :src="currentSong.cover" fit="cover">
            <template #error>
              <div class="image-error">
                <icon-image :size="60" />
              </div>
            </template>
          </a-image>
        </div>
      </a-card>
    </div>

    <!-- 右侧：歌曲信息和歌词 -->
    <div class="right-section">
      <!-- 主内容区域 -->
      <div class="content-wrapper">
        <!-- 歌曲信息 -->
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <a-space :size="20" class="song-meta">
            <a-typography-text type="secondary">专辑: {{ currentSong.album }}</a-typography-text>
            <a-divider direction="vertical" />
            <a-typography-text type="secondary">歌手: {{ currentSong.artist }}</a-typography-text>
          </a-space>
        </div>

        <!-- 歌词模式切换 -->
        <a-radio-group v-model="lyricMode" class="lyric-mode-tabs" type="button">
          <a-radio value="both">歌词</a-radio>
          <a-radio value="translation" :disabled="!hasTranslation">译文</a-radio>
        </a-radio-group>

        <!-- 歌词容器 -->
        <div ref="scrollbarRef" class="lyrics-scrollbar" @scroll="handleScroll">
          <div class="lyrics-wrapper">
            <a-empty v-if="!hasLyric && !loadingLyric" description="暂无歌词" />
            <a-skeleton v-else-if="loadingLyric" :loading="true" :animation="true">
              <a-skeleton-line :rows="10" />
            </a-skeleton>
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
        <a-button shape="circle" size="large" class="close-btn" @click="closeLyric">
          <template #icon>
            <icon-close :size="20" />
          </template>
        </a-button>

        <a-divider direction="horizontal" margin="12px" />

        <!-- 字号调整 -->
        <div class="font-size-control">
          <a-button
            shape="circle"
            size="small"
            :disabled="fontSize >= 32"
            @click="increaseFontSize"
          >
            <template #icon>
              <icon-plus />
            </template>
          </a-button>
          <a-tag color="arcoblue" class="size-tag">{{ fontSize }}</a-tag>
          <a-button
            shape="circle"
            size="small"
            :disabled="fontSize <= 14"
            @click="decreaseFontSize"
          >
            <template #icon>
              <icon-minus />
            </template>
          </a-button>
        </div>

        <a-divider direction="horizontal" margin="12px" />

        <!-- 自动滚动开关 -->
        <a-tooltip content="自动滚动" position="left">
          <a-switch v-model="autoScroll" type="round" size="small" class="auto-scroll-switch">
            <template #checked>
              <icon-check :size="14" />
            </template>
            <template #unchecked>
              <icon-close :size="14" />
            </template>
          </a-switch>
        </a-tooltip>

        <a-divider direction="horizontal" margin="12px" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { IconClose, IconPlus, IconMinus, IconImage, IconCheck } from '@arco-design/web-vue/es/icon'

const router = useRouter()
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

// 字号控制
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
  router.push('/')
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
  --lyric-line-opacity: 0.52;
  --lyric-line-padding: 14px 20px;
  --lyric-hover-shift: 3px;
  --lyric-active-text-scale: 1.05;
  --lyric-active-translation-scale: 1.02;
  --lyric-active-font-weight: 650;
  --lyric-active-glow: 0 0 18px var(--color-primary-light-2);
  --lyric-active-bg: linear-gradient(
    90deg,
    var(--color-primary-light-1) 0%,
    var(--color-primary-light-2) 100%
  );

  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-bg-1) 0%, var(--color-bg-2) 100%);

  .left-section {
    flex: 0 0 45%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
    background: linear-gradient(135deg, rgba(var(--primary-6), 0.03) 0%, transparent 100%);
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(
        circle at center,
        rgba(var(--primary-6), 0.08) 0%,
        transparent 70%
      );
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
        0 0 0 1px var(--color-border-2);
      background: var(--color-bg-2);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      z-index: 1;

      &:hover {
        transform: scale(1.02);
        box-shadow:
          0 20px 60px rgba(0, 0, 0, 0.4),
          0 0 0 1px var(--color-border-2);
      }

      .song-cover {
        width: 100%;
        height: 100%;
        position: relative;

        :deep(.arco-image) {
          width: 100%;
          height: 100%;
          border-radius: 20px;

          img {
            object-fit: cover;
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
          background: var(--color-fill-2);
          color: var(--color-text-4);
        }
      }
    }
  }

  .right-section {
    flex: 1;
    display: flex;
    background: var(--color-bg-2);
    color: var(--color-text-1);
    border-left: 1px solid var(--color-border-2);
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
          color: var(--color-text-1);
        }

        .song-meta {
          :deep(.arco-typography) {
            color: var(--color-text-3);
            font-size: 14px;
          }

          :deep(.arco-divider) {
            background-color: var(--color-border-2);
          }
        }
      }

      .lyric-mode-tabs {
        flex-shrink: 0;
        margin-bottom: 16px;
        padding: 4px;
        background: var(--color-fill-2);
        border-radius: 10px;
        display: inline-flex;
        width: fit-content;

        :deep(.arco-radio) {
          background: transparent;
          border: none;
          color: var(--color-text-3);
          border-radius: 8px;
          padding: 6px 20px;
          transition: all 0.3s ease;

          &:hover:not(.arco-radio-disabled) {
            color: var(--color-text-2);
            background: var(--color-fill-3);
          }

          &.arco-radio-checked {
            color: var(--color-primary-6);
            background: var(--color-bg-2);
            box-shadow: 0 2px 8px var(--color-fill-3);
            font-weight: 600;
          }

          &.arco-radio-disabled {
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
          background: var(--color-fill-2);
          border-radius: 3px;
        }

        &::-webkit-scrollbar-thumb {
          background: var(--color-fill-4);
          border-radius: 3px;

          &:hover {
            background: var(--color-primary-6);
          }
        }

        .lyrics-wrapper {
          padding: 40% 0;
          min-height: 100%;

          :deep(.arco-empty) {
            color: var(--color-text-3);
          }

          .lyric-line {
            text-align: left;
            opacity: var(--lyric-line-opacity);
            cursor: pointer;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            padding: var(--lyric-line-padding);
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
              background: var(--color-primary-6);
              border-radius: 0 2px 2px 0;
              transition: height 0.3s ease;
            }

            .lyric-text {
              display: block;
              line-height: 1.85;
              font-weight: 400;
              color: var(--color-text-1);
              transition: all 0.3s ease;
              text-wrap: pretty;
            }

            .lyric-translation {
              display: block;
              line-height: 1.6;
              margin-top: 6px;
              color: var(--color-text-3);
              transition: all 0.3s ease;
              text-wrap: pretty;
            }

            &:hover {
              opacity: 0.8;
              background: var(--color-fill-2);
              transform: translateX(var(--lyric-hover-shift));
            }

            &:focus-visible {
              opacity: 0.9;
              background: var(--color-fill-2);
              box-shadow: 0 0 0 2px var(--color-primary-light-3);
            }

            &.active {
              opacity: 1;
              background: var(--lyric-active-bg);

              &::before {
                height: 60%;
              }

              .lyric-text {
                font-weight: var(--lyric-active-font-weight);
                color: var(--color-primary-6);
                transform: scale(var(--lyric-active-text-scale));
                transform-origin: left center;
                text-shadow: var(--lyric-active-glow);
              }

              .lyric-translation {
                opacity: 0.9;
                color: var(--color-text-2);
                transform: scale(var(--lyric-active-translation-scale));
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
      border-left: 1px solid var(--color-border-2);
      background: var(--color-bg-1);
      width: auto;
      min-width: 80px;

      .close-btn {
        margin-bottom: 8px;

        :deep(.arco-btn) {
          &:hover {
            background: var(--color-danger-light-1);
            border-color: var(--color-danger-6);
            color: var(--color-danger-6);
          }
        }
      }

      :deep(.arco-divider-horizontal) {
        width: 100%;
        min-width: 40px;
        background-color: var(--color-border-2);
      }

      .font-size-control {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;

        :deep(.arco-btn) {
          background: transparent;
          border: 1px solid var(--color-border-2);
          color: var(--color-text-3);
          transition: all 0.3s ease;

          &:hover:not(.arco-btn-disabled) {
            background: var(--color-fill-2);
            color: var(--color-primary-6);
            border-color: var(--color-primary-6);
          }

          &.arco-btn-disabled {
            opacity: 0.3;
          }
        }

        .size-tag {
          background: var(--color-bg-2);
          border: 1px solid var(--color-border-2);
          color: var(--color-text-2);
          font-weight: 600;
          padding: 4px 8px;
          font-size: 12px;
        }
      }

      .auto-scroll-switch {
        :deep(.arco-switch) {
          &.arco-switch-checked {
            background-color: var(--color-primary-6);
          }
        }
      }

      .preset-toggle-btn {
        width: 28px;
        height: 28px;
        min-width: 28px;
        font-size: 12px;
        font-weight: 700;
        border: 1px solid var(--color-border-2);
        color: var(--color-text-2);
        background: var(--color-bg-2);
        transition: all 0.3s ease;

        &:hover {
          color: var(--color-primary-6);
          border-color: var(--color-primary-6);
          background: var(--color-fill-2);
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
      border-top: 1px solid var(--color-border-2);
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
            padding: 28% 0;

            .lyric-line {
              margin: 4px 0;
              border-radius: 6px;
            }
          }
        }
      }

      .side-toolbar {
        border-left: none;
        border-top: 1px solid var(--color-border-2);
        flex-direction: row;
        min-width: auto;
        width: auto;
        height: auto;
        gap: 12px;
        padding: 12px 20px;

        .close-btn {
          margin-bottom: 0;
        }

        :deep(.arco-divider-horizontal) {
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
