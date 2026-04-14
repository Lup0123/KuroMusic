const KEYWORDS_TO_QUERY = 6
const SONG_LIMIT = 30

const CHINESE_TOKEN_PATTERN = /[\u4e00-\u9fa5]{2,}/g
const LATIN_TOKEN_PATTERN = /[A-Za-z0-9]{3,}/g

function uniqueArray(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function normalizeSong(song) {
  if (!song || typeof song !== 'object') return null
  const artists = Array.isArray(song.artists)
    ? song.artists
    : typeof song.artist === 'string'
      ? song.artist
          .split('/')
          .map((name) => ({ name: name.trim() }))
          .filter((item) => item.name)
      : []

  return {
    id: song.id,
    name: song.name || '未知歌曲',
    artist:
      artists
        .map((artist) => artist?.name)
        .filter(Boolean)
        .join(' / ') || '未知艺术家',
    album: song.album || '未知专辑',
    albumCover: song.albumCover || '',
    durationMs: Number(song.durationMs) || 0,
    duration: song.duration || '--:--'
  }
}

function normalizeBaseSong(song) {
  if (!song || typeof song !== 'object' || !song.id) return null
  return {
    id: song.id,
    name: song.name || '未知歌曲',
    artist: song.artist || '未知艺术家',
    album: song.album || '未知专辑',
    albumCover: song.albumCover || song.cover || '',
    durationMs: Number(song.durationMs) || 0,
    duration: song.duration || '--:--'
  }
}

function isAdjustmentPrompt(prompt) {
  const text = String(prompt || '')
  return /(再|继续|调整|改成|换成|多一点|少一点|不要|增加|减少)/.test(text)
}

function deriveQueryKeywords(prompt, intent) {
  const text = `${prompt || ''} ${intent || ''}`
  const chineseTokens = text.match(CHINESE_TOKEN_PATTERN) || []
  const latinTokens = text.match(LATIN_TOKEN_PATTERN) || []

  return uniqueArray([...chineseTokens, ...latinTokens]).slice(0, KEYWORDS_TO_QUERY)
}

function buildDraftName(prompt, intent) {
  const seed = (intent || prompt || 'AI推荐').trim().slice(0, 12)
  return `${seed || 'AI推荐'}歌单`
}

function parseOpenAIResponse(content) {
  try {
    const parsed = JSON.parse(content)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export async function recommendPlaylistByLLM({ prompt, context = {}, searchSongs, llmClient }) {
  const safePrompt = String(prompt || '').trim()
  if (!safePrompt) {
    return {
      recommendations: [],
      draft: { name: 'AI推荐歌单', reason: '提示词为空', songs: [] },
      debug: { provider: 'llm', emptyPrompt: true }
    }
  }

  let parsed = null
  if (llmClient) {
    const completion = await llmClient({
      prompt: safePrompt,
      messages: Array.isArray(context?.messages) ? context.messages : []
    })
    parsed = parseOpenAIResponse(completion)
  }

  const intent = parsed?.intent || safePrompt
  const keywords = deriveQueryKeywords(safePrompt, intent)
  const allSongs = []

  for (const keyword of keywords) {
    const songs = await searchSongs(keyword, SONG_LIMIT)
    for (const song of songs || []) {
      const normalized = normalizeSong(song)
      if (normalized?.id) allSongs.push(normalized)
    }
  }

  const dedupedMap = new Map()

  if (isAdjustmentPrompt(safePrompt) && Array.isArray(context?.baseSongs)) {
    for (const song of context.baseSongs) {
      const normalized = normalizeBaseSong(song)
      if (normalized?.id && !dedupedMap.has(normalized.id)) {
        dedupedMap.set(normalized.id, normalized)
      }
    }
  }

  for (const song of allSongs) {
    if (!dedupedMap.has(song.id)) dedupedMap.set(song.id, song)
  }
  const dedupedSongs = Array.from(dedupedMap.values()).slice(0, SONG_LIMIT)

  return {
    recommendations: [
      {
        id: 'llm-primary',
        title: buildDraftName(safePrompt, intent),
        reason: parsed?.reason || `根据你的描述「${safePrompt}」推荐`,
        songs: dedupedSongs.slice(0, 20)
      }
    ],
    draft: {
      name: buildDraftName(safePrompt, intent),
      reason: parsed?.reason || `根据你的描述「${safePrompt}」生成`,
      songs: dedupedSongs
    },
    debug: {
      provider: 'llm',
      intent,
      keywords,
      fetchedCount: allSongs.length,
      uniqueCount: dedupedSongs.length
    }
  }
}
