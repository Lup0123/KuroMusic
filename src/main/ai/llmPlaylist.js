const KEYWORDS_TO_QUERY = 6
const MAX_SONG_NAME_LENGTH = 80
const INVALID_NAME_PATTERNS = [
  /请提供需要提取歌名/i,
  /如果您输入/i,
  /我会输出/i,
  /如果没有歌名/i,
  /请提供您的文本内容/i,
  /^0$/
]

const CHINESE_TOKEN_PATTERN = /[\u4e00-\u9fa5]{2,}/g
const LATIN_TOKEN_PATTERN = /[A-Za-z0-9]{3,}/g
const SONG_LIMIT_DEFAULT = 30
const SONG_LIMIT_MAX = 80
const MAX_EXPANSION_ROUNDS = 3

function uniqueArray(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function isLikelyInvalidSong(song) {
  const name = String(song?.name || '').trim()
  if (!name) return true
  if (name.length > MAX_SONG_NAME_LENGTH) return true
  if (name.includes('\n')) return true
  if (INVALID_NAME_PATTERNS.some((pattern) => pattern.test(name))) return true

  const artist = String(song?.artist || '').trim()
  if (!artist || artist === '未知艺术家') return true

  return false
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function shouldExcludeSong(song, excludeKeywords = []) {
  const excludes = (excludeKeywords || [])
    .map((item) => normalizeText(item))
    .filter((item) => item && item.length >= 2)
  if (excludes.length === 0) return false

  const haystack = normalizeText(`${song?.name || ''} ${song?.artist || ''} ${song?.album || ''}`)
  return excludes.some((keyword) => haystack.includes(keyword))
}

function countMatchedKeywords(song, keywords = []) {
  const list = (keywords || [])
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= 2)
  if (list.length === 0) return 0
  const haystack = normalizeText(`${song?.name || ''} ${song?.artist || ''} ${song?.album || ''}`)
  let count = 0
  for (const keyword of list) {
    if (haystack.includes(keyword)) count += 1
  }
  return count
}

function scoreSongCandidate(song, { artist = '', include = [], mood = '', language = '' } = {}) {
  const artistKeyword = normalizeText(artist)
  const artistText = normalizeText(song?.artist)
  const includeHitCount = countMatchedKeywords(song, include)
  const moodHit = mood ? countMatchedKeywords(song, [mood]) : 0
  const languageHit = language ? countMatchedKeywords(song, [language]) : 0

  let score = includeHitCount * 4 + moodHit * 2 + languageHit * 2
  if (artistKeyword && artistText.includes(artistKeyword)) {
    score += 8
  }

  return {
    score,
    includeHitCount,
    artistMatched: Boolean(artistKeyword && artistText.includes(artistKeyword))
  }
}

function applyHardConstraintCandidates(candidates, { artist = '', include = [] } = {}) {
  const hasArtistConstraint = Boolean(normalizeText(artist))
  const hasIncludeConstraint = Array.isArray(include) && include.length > 0

  if (!hasArtistConstraint && !hasIncludeConstraint) {
    return {
      constrained: candidates,
      strictMode: false,
      droppedCount: 0
    }
  }

  const constrained = candidates.filter((item) => {
    if (hasArtistConstraint && !item.artistMatched) return false
    if (hasIncludeConstraint && item.includeHitCount <= 0) return false
    return true
  })

  // 保底：如果严格过滤后结果过少，则退回到打分排序结果，避免空推荐
  if (constrained.length >= 8) {
    return {
      constrained,
      strictMode: true,
      droppedCount: Math.max(0, candidates.length - constrained.length)
    }
  }

  return {
    constrained: candidates,
    strictMode: false,
    droppedCount: 0
  }
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

function parseExpectedCount(prompt = '') {
  const text = String(prompt || '')
  const withUnit = text.match(/(?:不少于|至少|新增|加|添加|补充|来)?\s*(\d{1,3})\s*(?:首|个)?/)
  if (withUnit?.[1]) {
    return Number(withUnit[1]) || 0
  }
  return 0
}

function pickPrimaryArtistFromBaseSongs(baseSongs = []) {
  const counter = new Map()
  for (const song of baseSongs || []) {
    const artist = String(song?.artist || '').trim()
    if (!artist || artist === '未知艺术家') continue
    counter.set(artist, (counter.get(artist) || 0) + 1)
  }
  return Array.from(counter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

function resolveArtistByReference(prompt = '', parsedArtist = '', baseSongs = []) {
  const explicit = String(parsedArtist || '').trim()
  if (explicit) return explicit

  const text = String(prompt || '')
  if (/(这个歌手|该歌手|同一个歌手|这个艺人|该艺人)/.test(text)) {
    return pickPrimaryArtistFromBaseSongs(baseSongs)
  }
  return ''
}

function buildQueryKeywords({ prompt, intent, artist, include = [] }) {
  const chunks = [artist, ...(include || []), prompt || '', intent || '']
  const text = chunks.filter(Boolean).join(' ')
  const chineseTokens = text.match(CHINESE_TOKEN_PATTERN) || []
  const latinTokens = text.match(LATIN_TOKEN_PATTERN) || []
  return uniqueArray([artist, ...include, ...chineseTokens, ...latinTokens].filter(Boolean)).slice(
    0,
    KEYWORDS_TO_QUERY
  )
}

function buildExpansionKeywords({ artist = '', include = [], prompt = '', intent = '' }) {
  const seeds = [artist, ...(include || [])].filter(Boolean)
  const artistSeed = String(artist || '').trim()
  const artistCompact = artistSeed.replace(/\s+/g, '')
  const promptText = `${prompt || ''} ${intent || ''}`
  const chineseTokens = (promptText.match(CHINESE_TOKEN_PATTERN) || []).slice(0, 8)
  const latinTokens = (promptText.match(LATIN_TOKEN_PATTERN) || []).slice(0, 8)

  const expansions = [
    artistSeed ? `${artistSeed} 热门` : '',
    artistSeed ? `${artistSeed} 新歌` : '',
    artistSeed ? `${artistSeed} 代表作` : '',
    artistCompact ? `${artistCompact} live` : '',
    ...chineseTokens,
    ...latinTokens
  ]

  return uniqueArray([...seeds, ...expansions].filter(Boolean)).slice(0, 12)
}

function resolveTargetSongLimit({ prompt, parsedCount }) {
  const fromPrompt = parseExpectedCount(prompt)
  const fromLlm = Number(parsedCount) || 0
  const raw = Math.max(fromPrompt, fromLlm, SONG_LIMIT_DEFAULT)
  return Math.min(Math.max(raw, 10), SONG_LIMIT_MAX)
}

function isAdjustmentPrompt(prompt) {
  const text = String(prompt || '')
  return /(再|继续|调整|改成|换成|多一点|少一点|不要|增加|减少)/.test(text)
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

export async function recommendPlaylistByLLM({
  prompt,
  context = {},
  searchSongs,
  llmClient,
  semanticExpander
}) {
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
  const artist = resolveArtistByReference(
    safePrompt,
    parsed?.artist || '',
    context?.baseSongs || []
  )
  const include = Array.isArray(parsed?.include) ? parsed.include.filter(Boolean).slice(0, 4) : []
  const exclude = Array.isArray(parsed?.exclude) ? parsed.exclude.filter(Boolean).slice(0, 4) : []
  const baseKeywords = buildQueryKeywords({
    prompt: safePrompt,
    intent,
    artist,
    include
  })
  let keywords = baseKeywords
  let semanticTags = []

  if (typeof semanticExpander === 'function') {
    try {
      const extra = await semanticExpander({
        prompt: safePrompt,
        intent,
        artist,
        include
      })
      semanticTags = uniqueArray(
        (Array.isArray(extra) ? extra : [])
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      ).slice(0, 3)
    } catch {
      // semantic expansion must never break recommendation
      semanticTags = []
    }

    if (semanticTags.length > 0) {
      const explicitTerms = [artist, ...(include || [])].filter(Boolean)
      const explicitSet = new Set(explicitTerms.map((item) => normalizeText(item)).filter(Boolean))
      const tokenKeywords = baseKeywords.filter((item) => !explicitSet.has(normalizeText(item)))
      const merged = []
      const seen = new Set()

      for (const item of [...explicitTerms, ...semanticTags, ...tokenKeywords]) {
        const key = normalizeText(item)
        if (!key || seen.has(key)) continue
        seen.add(key)
        merged.push(item)
        if (merged.length >= KEYWORDS_TO_QUERY) break
      }

      if (merged.length > 0) keywords = merged
    }
  }

  const targetSongLimit = resolveTargetSongLimit({ prompt: safePrompt, parsedCount: parsed?.count })
  const searchLimit = Math.min(50, Math.max(20, targetSongLimit))
  const allSongs = []
  const fetchedKeywordPages = []

  for (const keyword of keywords) {
    const songs = await searchSongs(keyword, searchLimit, 0)
    fetchedKeywordPages.push({ keyword, offset: 0, count: (songs || []).length })
    for (const song of songs || []) {
      const normalized = normalizeSong(song)
      if (normalized?.id) allSongs.push(normalized)
    }
  }

  const expansionKeywords = buildExpansionKeywords({
    artist,
    include,
    prompt: safePrompt,
    intent
  })

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
  const scoredCandidates = Array.from(dedupedMap.values())
    .filter((song) => !isLikelyInvalidSong(song))
    .filter((song) => !shouldExcludeSong(song, exclude))
    .map((song, index) => ({
      song,
      index,
      ...scoreSongCandidate(song, {
        artist,
        include,
        mood: parsed?.mood || '',
        language: parsed?.language || ''
      })
    }))

  const preferred = scoredCandidates
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
  const fallback = scoredCandidates
    .filter((item) => item.score <= 0)
    .sort((a, b) => a.index - b.index)

  const rankedCandidates = [...preferred, ...fallback]
  const { constrained, strictMode, droppedCount } = applyHardConstraintCandidates(
    rankedCandidates,
    {
      artist,
      include
    }
  )

  let merged = constrained.slice(0, targetSongLimit)
  let dedupedSongs = merged.map((item) => item.song)

  let expansionRounds = 0
  let expansionFetchedCount = 0
  let expansionTriggered = false

  if (dedupedSongs.length < targetSongLimit) {
    expansionTriggered = true
  }

  while (dedupedSongs.length < targetSongLimit && expansionRounds < MAX_EXPANSION_ROUNDS) {
    const nextKeyword = expansionKeywords[expansionRounds % expansionKeywords.length]
    if (!nextKeyword) break

    const offset = (expansionRounds + 1) * searchLimit
    const extraSongs = await searchSongs(nextKeyword, searchLimit, offset)
    fetchedKeywordPages.push({ keyword: nextKeyword, offset, count: (extraSongs || []).length })
    expansionFetchedCount += (extraSongs || []).length

    for (const song of extraSongs || []) {
      const normalized = normalizeSong(song)
      if (normalized?.id && !dedupedMap.has(normalized.id)) {
        dedupedMap.set(normalized.id, normalized)
      }
    }

    const rescored = Array.from(dedupedMap.values())
      .filter((song) => !isLikelyInvalidSong(song))
      .filter((song) => !shouldExcludeSong(song, exclude))
      .map((song, index) => ({
        song,
        index,
        ...scoreSongCandidate(song, {
          artist,
          include,
          mood: parsed?.mood || '',
          language: parsed?.language || ''
        })
      }))

    const rescoredPreferred = rescored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
    const rescoredFallback = rescored
      .filter((item) => item.score <= 0)
      .sort((a, b) => a.index - b.index)

    const rescoredRanked = [...rescoredPreferred, ...rescoredFallback]
    const constrainedResult = applyHardConstraintCandidates(rescoredRanked, {
      artist,
      include
    })

    merged = constrainedResult.constrained.slice(0, targetSongLimit)
    dedupedSongs = merged.map((item) => item.song)
    expansionRounds += 1
  }

  const includeMatchedCount = merged.filter((item) => item.includeHitCount > 0).length
  const artistMatchedCount = merged.filter((item) => item.artistMatched).length

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
      artist,
      include,
      exclude,
      includeMatchedCount,
      artistMatchedCount,
      strictMode,
      strictDroppedCount: droppedCount,
      expansionTriggered,
      expansionRounds,
      expansionFetchedCount,
      fetchedKeywordPages,
      targetSongLimit,
      keywords,
      semanticTags,
      fetchedCount: allSongs.length,
      uniqueCount: dedupedSongs.length,
      llmTrace: parsed?.llmTrace || null
    }
  }
}
