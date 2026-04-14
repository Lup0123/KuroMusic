<template>
  <div class="app-cover" :style="containerStyle">
    <img
      v-if="displaySrc"
      class="cover-img"
      :class="{ loaded: isLoaded }"
      :src="displaySrc"
      :alt="alt"
      loading="lazy"
      @load="handleLoad"
      @error="handleError"
    />
    <div v-if="!displaySrc" class="cover-fallback">
      <slot name="fallback">♪</slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { normalizeCoverUrl } from '@/utils/image'

const props = defineProps({
  src: {
    type: String,
    default: ''
  },
  size: {
    type: Number,
    default: 200
  },
  width: {
    type: [Number, String],
    default: undefined
  },
  height: {
    type: [Number, String],
    default: undefined
  },
  radius: {
    type: [Number, String],
    default: 8
  },
  alt: {
    type: String,
    default: 'cover'
  }
})

const normalizedSrc = computed(() => normalizeCoverUrl(props.src, props.size))
const displaySrc = ref(normalizedSrc.value)
const isLoaded = ref(false)

watch(
  normalizedSrc,
  (next, prev) => {
    if (next === prev) return
    if (!next) {
      displaySrc.value = ''
      isLoaded.value = false
      return
    }

    const probe = new Image()
    probe.onload = () => {
      displaySrc.value = next
      isLoaded.value = true
    }
    probe.onerror = () => {
      displaySrc.value = next
      isLoaded.value = true
    }
    probe.src = next
  },
  { immediate: true }
)

const toCssSize = (value) => {
  if (value === undefined || value === null || value === '') return '100%'
  return typeof value === 'number' ? `${value}px` : value
}

const containerStyle = computed(() => ({
  width: toCssSize(props.width),
  height: toCssSize(props.height),
  borderRadius: typeof props.radius === 'number' ? `${props.radius}px` : props.radius
}))

const handleLoad = () => {
  isLoaded.value = true
}

const handleError = () => {
  isLoaded.value = true
}
</script>

<style scoped>
.app-cover {
  position: relative;
  overflow: hidden;
  background: var(--n-hover-color);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.cover-img.loaded {
  opacity: 1;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--n-text-color-3);
  font-size: 14px;
}
</style>
