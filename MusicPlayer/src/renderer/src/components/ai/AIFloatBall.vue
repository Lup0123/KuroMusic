<template>
  <button
    class="ai-float-ball"
    :style="ballStyle"
    type="button"
    aria-label="打开 AI 歌单助手"
    @pointerdown="onPointerDown"
    @click="onClick"
  >
    AI
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useThemeVars } from 'naive-ui'
import { useAiPlaylistStore } from '@/stores/aiPlaylistStore'

const STORAGE_KEY = 'aiFloatBallPosition'
const BALL_SIZE = 52
const OFFSET_DEFAULTS = {
  top: 72,
  bottom: 96,
  edge: 16
}
const CLICK_DISTANCE_THRESHOLD = 8
const RESIZE_PERSIST_DELAY = 180

const aiPlaylistStore = useAiPlaylistStore()
const themeVars = useThemeVars()

const dock = ref('right')
const y = ref(120)

const dragState = {
  active: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  startBallY: 0,
  moved: false
}

let suppressNextClick = false
let resizePersistTimer = null

const ballStyle = computed(() => ({
  top: `${y.value}px`,
  left: dock.value === 'left' ? `var(--ai-float-ball-edge-offset, ${OFFSET_DEFAULTS.edge}px)` : 'auto',
  right: dock.value === 'right' ? `var(--ai-float-ball-edge-offset, ${OFFSET_DEFAULTS.edge}px)` : 'auto',
  background: themeVars.value.primaryColor,
  color: themeVars.value.baseColor
}))

function getOffset(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampY(nextY) {
  const topOffset = getOffset('--ai-float-ball-top-offset', OFFSET_DEFAULTS.top)
  const bottomOffset = getOffset('--ai-float-ball-bottom-offset', OFFSET_DEFAULTS.bottom)
  const maxY = Math.max(topOffset, window.innerHeight - BALL_SIZE - bottomOffset)
  return Math.min(Math.max(nextY, topOffset), maxY)
}

function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1)
}

function persistPosition() {
  const value = {
    dock: dock.value,
    y: y.value
  }

  aiPlaylistStore.setFloatBallPosition(value)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore write failures in restricted environments
  }
}

function restorePosition() {
  let restored = null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      restored = JSON.parse(raw)
    }
  } catch {
    restored = null
  }

  if (!restored) {
    restored = aiPlaylistStore.floatBall
  }

  if (restored && (restored.dock === 'left' || restored.dock === 'right')) {
    dock.value = restored.dock
  }

  if (restored && Number.isFinite(restored.y)) {
    y.value = clampY(restored.y)
  } else {
    y.value = clampY(y.value)
  }
}

function onPointerMove(event) {
  if (!dragState.active || dragState.pointerId !== event.pointerId) return

  const nextY = dragState.startBallY + (event.clientY - dragState.startY)
  y.value = clampY(nextY)

  const movedDistance = getDistance(dragState.startX, dragState.startY, event.clientX, event.clientY)
  if (movedDistance > CLICK_DISTANCE_THRESHOLD) {
    dragState.moved = true
  }

  dock.value = event.clientX <= window.innerWidth / 2 ? 'left' : 'right'
}

function onPointerUp(event) {
  if (dragState.pointerId !== event.pointerId) return

  dragState.active = false
  dragState.pointerId = null
  suppressNextClick = true
  persistPosition()

  if (!dragState.moved) {
    aiPlaylistStore.openModal()
  }
}

function onPointerCancel(event) {
  if (dragState.pointerId !== event.pointerId) return

  dragState.active = false
  dragState.pointerId = null
  persistPosition()
}

function onClick() {
  if (suppressNextClick) {
    suppressNextClick = false
    return
  }

  aiPlaylistStore.openModal()
}

function onPointerDown(event) {
  dragState.active = true
  dragState.pointerId = event.pointerId
  dragState.startX = event.clientX
  dragState.startY = event.clientY
  dragState.startBallY = y.value
  dragState.moved = false

  event.currentTarget?.setPointerCapture?.(event.pointerId)
}

function onResize() {
  y.value = clampY(y.value)

  if (resizePersistTimer) {
    window.clearTimeout(resizePersistTimer)
  }

  resizePersistTimer = window.setTimeout(() => {
    persistPosition()
    resizePersistTimer = null
  }, RESIZE_PERSIST_DELAY)
}

onMounted(() => {
  restorePosition()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  if (resizePersistTimer) {
    window.clearTimeout(resizePersistTimer)
    resizePersistTimer = null
  }

  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped lang="scss">
.ai-float-ball {
  position: fixed;
  z-index: 2102;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  border: 0;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.4px;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: box-shadow 0.2s ease;

  &:active {
    cursor: grabbing;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
  }
}
</style>
