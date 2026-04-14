const DEFAULT_KEYWORD = '热门'
const DEFAULT_MAX_SONGS = 30
const DEFAULT_SEARCH_LIMIT = 30
const SAFE_MIN_SONGS = 5
const MAX_RECOMMENDATION_SONGS = 20
const MAX_KEYWORDS = 4
const MAX_RAW_PROMPT_KEYWORD_LENGTH = 24

const SIGNAL_RULES = {
  moods: [
    { value: '轻松', pattern: /(轻松|chill|relax|放松)/i },
    { value: '快乐', pattern: /(快乐|开心|高兴|happy)/i },
    { value: '伤感', pattern: /(伤感|难过|emo|sad)/i },
    { value: '治愈', pattern: /(治愈|温暖|calm|heal)/i },
    { value: '专注', pattern: /(专注|学习|focus|deep work)/i },
    { value: '动感', pattern: /(动感|燃|激情|workout|energy)/i }
  ],
  scenes: [
    { value: '通勤', pattern: /(通勤|地铁|公交|上班路上|commute)/i },
    { value: '学习', pattern: /(学习|写作业|阅读|study)/i },
    { value: '工作', pattern: /(工作|办公|加班|work)/i },
    { value: '跑步', pattern: /(跑步|健身|运动|run|gym)/i },
    { value: '夜晚', pattern: /(夜晚|深夜|晚上|night)/i },
    { value: '旅行', pattern: /(旅行|旅途|road trip|trip)/i }
  ],
  languages: [
    { value: '华语', pattern: /(中文|华语|国语|中文歌|mandarin|chinese)/i },
    { value: '欧美', pattern: /(英文|欧美|英语|english|western)/i },
    { value: '日语', pattern: /(日语|日文|jpop|j-pop|japanese)/i },
    { value: '韩语', pattern: /(韩语|韩文|kpop|k-pop|korean)/i },
    { value: '纯音乐', pattern: /(纯音乐|无歌词|instrumental|lofi|lo-fi)/i }
  ]
}

function pushIfMatched(text, rules) {
  const values = []
  for (const rule of rules) {
    if (rule.pattern.test(text)) values.push(rule.value)
  }
  return values
}

export function parsePromptToSignals(prompt) {
  const text = String(prompt || '').trim()
  return {
    prompt: text,
    moods: pushIfMatched(text, SIGNAL_RULES.moods),
    scenes: pushIfMatched(text, SIGNAL_RULES.scenes),
    languages: pushIfMatched(text, SIGNAL_RULES.languages)
  }
}

export function formatDuration(durationMs) {
  const totalSeconds = Math.floor(Number(durationMs) / 1000)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeSong(song) {
  const durationMs = Number(song?.dt ?? song?.durationMs)
  return {
    id: song?.id,
    name: song?.name || '未知歌曲',
    artist:
      song?.ar
        ?.map((item) => item?.name)
        .filter(Boolean)
        .join(' / ') ||
      song?.artist ||
      '未知艺术家',
    album: song?.al?.name || song?.album || '未知专辑',
    albumCover: song?.al?.picUrl || song?.albumCover || '',
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0,
    duration: song?.duration || formatDuration(durationMs)
  }
}

function scoreSong(song, signals, prompt) {
  const title = `${song?.name || ''} ${song?.artist || ''} ${song?.album || ''}`.toLowerCase()
  let score = 0

  const signalTerms = [...signals.moods, ...signals.scenes, ...signals.languages]
  for (const term of signalTerms) {
    if (term && title.includes(term.toLowerCase())) score += 3
  }

  const promptTerms = String(prompt || '')
    .split(/\s+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 1)
  for (const term of promptTerms) {
    if (title.includes(term)) score += 1
  }

  return score
}

function dedupeBySongId(songs) {
  const map = new Map()
  for (const song of songs || []) {
    if (!song?.id || map.has(song.id)) continue
    map.set(song.id, song)
  }
  return Array.from(map.values())
}

function sanitizeKeyword(value, maxLength = MAX_RAW_PROMPT_KEYWORD_LENGTH) {
  return String(value || '')
    .replace(/[<>"'`{}()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function scoreAndSortSongs(songs, signals, prompt) {
  return dedupeBySongId(songs)
    .map((song) => ({ ...song, __score: scoreSong(song, signals, prompt) }))
    .sort((a, b) => b.__score - a.__score)
    .map(({ __score, ...song }) => song)
}

export function buildDraftFromSongs(prompt, songs, maxSongs = DEFAULT_MAX_SONGS) {
  const boundedMaxSongs = Math.min(
    DEFAULT_MAX_SONGS,
    Math.max(1, Number(maxSongs) || DEFAULT_MAX_SONGS)
  )
  const deduped = dedupeBySongId(songs).slice(0, boundedMaxSongs)
  const trimmedPrompt = String(prompt || '').trim()
  const nameSeed = trimmedPrompt ? trimmedPrompt.slice(0, 12) : 'AI推荐'
  const reason = trimmedPrompt
    ? `根据你的提示「${trimmedPrompt}」生成的歌曲草案。`
    : '根据你的偏好信号生成的歌曲草案。'

  return {
    name: `${nameSeed}歌单`,
    reason,
    songs: deduped
  }
}

function pickKeywords(prompt, signals) {
  const promptKeyword = sanitizeKeyword(prompt)
  return Array.from(
    new Set([
      promptKeyword,
      ...signals.moods,
      ...signals.scenes,
      ...signals.languages,
      DEFAULT_KEYWORD
    ])
  )
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS)
}

async function searchSongsByKeyword(keyword, limit) {
  const searchFn = globalThis?.window?.api?.search
  if (typeof searchFn !== 'function') return []
  try {
    const response = await searchFn(keyword, 1, limit, 0)
    const songs = response?.body?.result?.songs
    if (!Array.isArray(songs)) return []
    return songs.map(normalizeSong)
  } catch {
    return []
  }
}

export async function recommendByRule(prompt, context = {}) {
  const signals = parsePromptToSignals(prompt)
  const keywords = pickKeywords(signals.prompt, signals)
  const maxSongs = Math.min(
    DEFAULT_MAX_SONGS,
    Math.max(1, Number(context?.maxSongs) || DEFAULT_MAX_SONGS)
  )
  const searchLimit = Math.max(1, Number(context?.searchLimit) || DEFAULT_SEARCH_LIMIT)

  const searchResults = await Promise.allSettled(
    keywords.map((keyword) => searchSongsByKeyword(keyword, searchLimit))
  )
  let allSongs = searchResults.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )

  const initialUniqueCount = dedupeBySongId(allSongs).length
  if (initialUniqueCount < SAFE_MIN_SONGS) {
    const broadenSongs = await searchSongsByKeyword(DEFAULT_KEYWORD, searchLimit)
    allSongs = allSongs.concat(broadenSongs)
  }

  const scoredSongs = scoreAndSortSongs(allSongs, signals, signals.prompt)
  const draft = buildDraftFromSongs(signals.prompt, scoredSongs, maxSongs)
  const recommendations = draft.songs.length
    ? [
        {
          id: 'primary',
          title: draft.name,
          reason: draft.reason,
          songs: draft.songs.slice(0, MAX_RECOMMENDATION_SONGS)
        }
      ]
    : []

  return {
    recommendations,
    draft,
    debug: {
      provider: 'rule',
      keywords,
      fetchedCount: allSongs.length,
      uniqueCount: dedupeBySongId(allSongs).length
    }
  }
}
