import { ref } from 'vue'

const playingSongId = ref(null)
const isPlaying = ref(false)
const loadingSongId = ref(null)

let audio = null

function resolveSongUrl(song) {
  if (song?.url) return Promise.resolve(song.url)
  return globalThis?.window?.api
    ?.getSongUrl?.(song.id, 'standard')
    .then((response) => response?.body?.data?.[0]?.url || '')
    .catch(() => '')
}

function stopInternal() {
  if (audio) {
    audio.pause()
    audio.src = ''
  }
  playingSongId.value = null
  isPlaying.value = false
  loadingSongId.value = null
}

export async function togglePreview(song) {
  const id = String(song?.id ?? '')
  if (!id) return

  // Same song: pause/resume
  if (playingSongId.value === id && audio) {
    if (isPlaying.value) {
      audio.pause()
      isPlaying.value = false
    } else {
      await audio.play().catch(() => {})
      isPlaying.value = true
    }
    return
  }

  stopInternal()
  loadingSongId.value = id

  const url = await resolveSongUrl(song)
  if (!url || loadingSongId.value !== id) {
    if (loadingSongId.value === id) loadingSongId.value = null
    return
  }

  if (!audio) {
    audio = new Audio()
    audio.addEventListener('ended', () => {
      isPlaying.value = false
      playingSongId.value = null
    })
    audio.addEventListener('error', () => {
      isPlaying.value = false
      loadingSongId.value = null
      playingSongId.value = null
    })
  }

  audio.src = url
  playingSongId.value = id
  loadingSongId.value = null
  try {
    await audio.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
  }
}

export function stopPreview() {
  stopInternal()
}

export function usePreviewPlayer() {
  return {
    playingSongId,
    isPlaying,
    loadingSongId,
    togglePreview,
    stopPreview
  }
}
