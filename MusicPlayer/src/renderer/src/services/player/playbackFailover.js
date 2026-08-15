const QUALITY_LEVELS = ['hires', 'lossless', 'exhigh', 'higher', 'standard']

function normalizeQuality(quality) {
  return QUALITY_LEVELS.includes(quality) ? quality : 'standard'
}

function getQualityFallbackChain(currentQuality) {
  const startIndex = QUALITY_LEVELS.indexOf(normalizeQuality(currentQuality))
  return QUALITY_LEVELS.slice(startIndex)
}

function getNextFallbackQuality(currentQuality, attemptedLevels = []) {
  const next = getQualityFallbackChain(currentQuality).find(
    (level) => !attemptedLevels.includes(level)
  )
  return next || null
}

function isLocalSong(song) {
  return Boolean(song && typeof song.path === 'string' && song.path.trim() !== '')
}

function buildSkipFeedbackMessage(count) {
  const safeCount = Math.max(1, Number(count) || 1)
  return `已跳过 ${safeCount} 首无法播放的歌曲`
}

export {
  QUALITY_LEVELS,
  normalizeQuality,
  getQualityFallbackChain,
  getNextFallbackQuality,
  isLocalSong,
  buildSkipFeedbackMessage
}
