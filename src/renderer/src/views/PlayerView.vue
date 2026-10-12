<template>
  <div class="lyrics-view">
    <!-- AMLL 流动背景（组件根为 display:contents，必须用真实容器包裹） -->
    <div class="amll-bg-box" aria-hidden="true">
      <BackgroundRender
        :album="currentSong.cover"
        :playing="!isPlaying"
        :fps="30"
        :flow-speed="2"
        :has-lyric="hasLyric"
      />
    </div>
    <div class="amll-scrim" aria-hidden="true"></div>

    <!-- 左侧：封面 + 歌曲信息 -->
    <div class="left-section">
      <div class="cover-card">
        <n-image :src="currentSong.cover" :preview-disabled="true" object-fit="cover">
          <template #placeholder>
            <div class="cover-fallback">
              <n-icon :size="64"><ImageOutline /></n-icon>
            </div>
          </template>
        </n-image>
      </div>
      <div class="song-meta">
        <div class="song-title" :title="currentSong.name">{{ currentSong.name }}</div>
        <div class="song-artist" :title="currentSong.artist">{{ currentSong.artist }}</div>
        <div class="song-album" :title="currentSong.album">{{ currentSong.album }}</div>
      </div>
    </div>

    <!-- 右侧：歌词 -->
    <div class="right-section">
      <div
        ref="scrollRef"
        class="lyrics-scroll"
        :style="{ '--lyric-font': fontSize + 'px' }"
        @scroll="handleScroll"
      >
        <div v-if="!hasLyric && !loadingLyric" class="lyric-state">
          <n-empty description="暂无歌词" />
        </div>
        <div v-else-if="loadingLyric" class="lyric-state lyric-skeleton">
          <n-skeleton v-for="n in 8" :key="n" text :style="{ width: 60 + ((n * 7) % 35) + '%' }" />
        </div>
        <template v-else>
          <div class="lyric-pad"></div>
          <div
            v-for="(line, i) in mergedLyrics"
            :key="i"
            ref="lineRefs"
            class="lyric-line"
            :class="{ active: i === currentLineIndex, passed: i < currentLineIndex }"
            @click="seekToLine(line)"
          >
            <div class="lyric-main">{{ line.text }}</div>
            <div v-if="line.translation" class="lyric-trans">{{ line.translation }}</div>
          </div>
          <div class="lyric-pad"></div>
        </template>
      </div>
    </div>

    <!-- 工具栏（融入背景，尽量清爽） -->
    <div class="toolbar">
      <n-button
        quaternary
        circle
        size="large"
        class="tool-btn"
        title="关闭"
        aria-label="关闭歌词页"
        @click="closeLyric"
      >
        <template #icon
          ><n-icon :size="22"><CloseOutline /></n-icon
        ></template>
      </n-button>

      <n-tooltip trigger="hover" placement="left">
        <template #trigger>
          <n-button
            quaternary
            circle
            size="large"
            class="tool-btn scroll-toggle"
            :class="{ active: autoScroll }"
            :aria-label="autoScroll ? '自动滚动：开' : '自动滚动：关'"
            :aria-pressed="autoScroll"
            @click="autoScroll = !autoScroll"
          >
            <template #icon
              ><n-icon :size="20"><LocateOutline /></n-icon
            ></template>
          </n-button>
        </template>
        {{ autoScroll ? '自动滚动：开' : '自动滚动：关' }}
      </n-tooltip>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { NImage, NEmpty, NSkeleton, NButton, NTooltip, NIcon } from 'naive-ui'
import { CloseOutline, ImageOutline, LocateOutline } from '@vicons/ionicons5'
import { BackgroundRender } from '@applemusic-like-lyrics/vue'

const router = useRouter()
const route = useRoute()
const songStore = useSongStore()
const { currentSong, currentTime, isPlaying } = storeToRefs(songStore)

const scrollRef = ref(null)
const lineRefs = ref([])

const rawLyrics = ref([])
const rawTranslationLyrics = ref([])
const currentLineIndex = ref(0)
const loadingLyric = ref(false)
const autoScroll = ref(true)
const userScrolling = ref(false)
const scrollTimer = ref(null)
const isProgrammaticScroll = ref(false)
const lyricsRequestId = ref(0)
const fontSize = ref(22)

const hasLyric = computed(() => rawLyrics.value.length > 0)
const hasTranslation = computed(() => rawTranslationLyrics.value.length > 0)

// 解析 LRC 歌词文本 -> [{ time(秒), text }]
const parseLyric = (lyricText) => {
  if (!lyricText) return []
  const lines = lyricText.split('\n')
  const result = []
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g

  lines.forEach((line) => {
    const matches = [...line.matchAll(timeRegex)]
    if (!matches.length) return
    const text = line.replace(timeRegex, '').trim()
    if (!text) return
    matches.forEach((m) => {
      const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3].padEnd(3, '0')) / 1000
      result.push({ time, text })
    })
  })

  return result.sort((a, b) => a.time - b.time)
}

// 主歌词 + 翻译按时间就近合并
const mergedLyrics = computed(() => {
  if (!rawLyrics.value.length) return []
  if (!hasTranslation.value) return rawLyrics.value.map((l) => ({ ...l, translation: '' }))

  const translations = rawTranslationLyrics.value
  let pointer = 0
  return rawLyrics.value.map((line) => {
    while (pointer < translations.length - 1 && translations[pointer + 1].time <= line.time) {
      pointer += 1
    }
    const cur = translations[pointer]
    const next = translations[pointer + 1]
    const best =
      next && Math.abs(next.time - line.time) < Math.abs(cur.time - line.time) ? next : cur
    const translation = best && Math.abs(best.time - line.time) <= 0.8 ? best.text : ''
    return { ...line, translation }
  })
})

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
    if (requestId !== lyricsRequestId.value) return

    if (response?.body?.lrc?.lyric) {
      rawLyrics.value = parseLyric(response.body.lrc.lyric)
      rawTranslationLyrics.value = response.body.tlyric?.lyric
        ? parseLyric(response.body.tlyric.lyric)
        : []
    } else {
      rawLyrics.value = []
      rawTranslationLyrics.value = []
    }
  } catch (error) {
    if (requestId !== lyricsRequestId.value) return
    console.error('加载歌词失败:', error)
    rawLyrics.value = []
    rawTranslationLyrics.value = []
  } finally {
    if (requestId === lyricsRequestId.value) loadingLyric.value = false
  }
}

// 二分查找当前时间对应的歌词行
const findCurrentLyricIndex = (lyrics, time) => {
  let left = 0
  let right = lyrics.length - 1
  let index = 0
  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    if (lyrics[mid].time <= time) {
      index = mid
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  return index
}

const updateCurrentLine = () => {
  const lyrics = mergedLyrics.value
  if (!lyrics.length) {
    currentLineIndex.value = 0
    return
  }
  const index = findCurrentLyricIndex(lyrics, currentTime.value)
  if (index !== currentLineIndex.value) {
    currentLineIndex.value = index
    if (autoScroll.value && !userScrolling.value) {
      nextTick(scrollToCurrentLine)
    }
  }
}

// 将当前行滚动到容器垂直中央（Apple Music 风格）
const scrollToCurrentLine = () => {
  const line = lineRefs.value[currentLineIndex.value]
  const container = scrollRef.value
  if (!line || !container) return
  try {
    const target = line.offsetTop - container.clientHeight / 2 + line.clientHeight / 2
    isProgrammaticScroll.value = true
    container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
    setTimeout(() => {
      isProgrammaticScroll.value = false
    }, 450)
  } catch (error) {
    isProgrammaticScroll.value = false
    console.error('滚动失败:', error)
  }
}

// 用户手动滚动时，暂停自动滚动一段时间
const handleScroll = () => {
  if (!autoScroll.value || isProgrammaticScroll.value) return
  userScrolling.value = true
  if (scrollTimer.value) clearTimeout(scrollTimer.value)
  scrollTimer.value = setTimeout(() => {
    userScrolling.value = false
    scrollToCurrentLine()
  }, 3000)
}

// 点击歌词行跳转到对应时间
const seekToLine = (line) => {
  if (!line || line.time === undefined) return
  const targetTime = line.time
  songStore.setCurrentTime(targetTime)
  if (songStore.audioElement) songStore.audioElement.currentTime = targetTime
  if (!songStore.isPlaying) songStore.togglePlay()
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

const closeLyric = () => {
  songStore.showLyric = false
  const nextQuery = { ...route.query }
  delete nextQuery.lyric
  router.push({ name: route.name, params: route.params, query: nextQuery })
}

const clampFontSize = (size) => (Number.isNaN(size) ? 22 : Math.min(32, Math.max(14, size)))

// 歌词字号在「设置 → 播放设置」中调整，这里读取持久化值
;(() => {
  const saved = localStorage.getItem('lyricFontSize')
  if (saved) fontSize.value = clampFontSize(parseInt(saved, 10))
})()

watch(
  () => currentSong.value?.id,
  (newId) => {
    if (newId) {
      loadLyrics(newId)
      currentLineIndex.value = 0
      userScrolling.value = false
      nextTick(scrollToCurrentLine)
    }
  },
  { immediate: true }
)

watch(currentTime, updateCurrentLine)

watch(autoScroll, (v) => {
  if (v) {
    userScrolling.value = false
    nextTick(scrollToCurrentLine)
  }
})

onUnmounted(() => {
  if (scrollTimer.value) clearTimeout(scrollTimer.value)
})
</script>

<style lang="scss" scoped>
.lyrics-view {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  color: #fff;
}

// AMLL 组件根为 display:contents，真实 canvas 是其子节点，需真实容器负责定位/尺寸
.amll-bg-box {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  :deep(canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }
}

.amll-scrim {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.45) 0%,
    rgba(0, 0, 0, 0.35) 45%,
    rgba(0, 0, 0, 0.55) 100%
  );
}

.left-section {
  position: relative;
  z-index: 1;
  flex: 0 0 42%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 48px;

  .cover-card {
    width: 100%;
    max-width: 400px;
    aspect-ratio: 1;
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);

    :deep(.n-image) {
      width: 100%;
      height: 100%;
      display: block;
    }
    :deep(img) {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cover-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.5);
    }
  }

  .song-meta {
    text-align: center;
    max-width: 400px;
    width: 100%;

    .song-title {
      font-size: 26px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .song-artist {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .song-album {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.55);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.right-section {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  display: flex;
}

.lyrics-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 6% 0 4%;
  scroll-behavior: smooth;
  // 上下淡出遮罩（Apple Music 观感）
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);
  mask-image: linear-gradient(180deg, transparent 0%, #000 14%, #000 86%, transparent 100%);

  &::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }
}

.lyric-pad {
  height: 42vh;
  flex-shrink: 0;
}

.lyric-state {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.6);

  &.lyric-skeleton {
    align-items: stretch;
    padding: 0 8%;
    :deep(.n-skeleton) {
      background-color: rgba(255, 255, 255, 0.12);
    }
  }
}

.lyric-line {
  padding: 14px 12px;
  border-radius: 12px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.4);
  transform-origin: left center;
  transition:
    color 0.3s ease,
    opacity 0.3s ease,
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    background-color 0.2s ease;

  .lyric-main {
    font-size: calc(var(--lyric-font, 22px) * 1.45);
    font-weight: 700;
    line-height: 1.3;
  }

  .lyric-trans {
    margin-top: 6px;
    font-size: calc(var(--lyric-font, 22px) * 0.92);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.45);
  }

  &:hover {
    background-color: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
  }

  &.passed {
    color: rgba(255, 255, 255, 0.32);
  }

  &.active {
    color: #fff;
    transform: scale(1.04);

    .lyric-trans {
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.toolbar {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 24px 0;
  // 歌词抽屉盖住了 navbar 的窗口拖拽区，按钮需显式 no-drag 才能正常点击
  -webkit-app-region: no-drag;

  // 融入背景：默认透明、低对比，hover 才轻微显现
  .tool-btn {
    color: rgba(255, 255, 255, 0.5);
    background: transparent;
    -webkit-app-region: no-drag;
    transition:
      color 0.2s ease,
      background-color 0.2s ease;

    &:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.14);
    }
  }

  // 自动滚动：图标常亮 = 开，变暗 = 关
  .scroll-toggle.active {
    color: #fff;
  }
}

@media (max-width: 900px) {
  .left-section {
    flex-basis: 34%;
    padding: 24px;
  }
}
</style>
