<template>
  <span>{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { formatDuration } from '@/utils/utils'

const props = defineProps({
  song: {
    type: Object,
    default: null
  },
  value: {
    type: [String, Number],
    default: null
  }
})

const label = computed(() => {
  const song = props.song || {}
  const raw = props.value ?? song?.duration
  if (typeof raw === 'string' && raw.includes(':')) return raw
  return formatDuration(Number(song?.dt ?? song?.durationMs ?? raw))
})
</script>
