import { TAG_LEXICON } from './tagLexicon'

/**
 * Match song metadata against the curated tag lexicon (substring based,
 * offline and cheap). Returns matched tag labels.
 */
export function matchLexiconTags(text) {
  const haystack = String(text || '').toLowerCase()
  if (!haystack) return []

  const matched = new Set()
  for (const item of TAG_LEXICON) {
    const terms = [item.label, ...(item.aliases || [])].filter(
      (term) => String(term || '').trim().length >= 2
    )
    for (const term of terms) {
      if (haystack.includes(String(term).toLowerCase())) {
        matched.add(item.label)
        break
      }
    }
  }
  return Array.from(matched)
}

/**
 * Aggregate raw behavior events into a lightweight preference profile:
 * top artists and matched tags with accumulated scores.
 */
export function aggregateBehaviorEvents(events = []) {
  const artistMap = new Map()
  const tagMap = new Map()

  for (const event of events) {
    const weight = Number(event?.weight) || 0
    const artist = String(event?.artist || '').trim()

    if (artist && artist !== '未知艺术家') {
      const key = artist.toLowerCase()
      const entry = artistMap.get(key) || { value: artist, score: 0 }
      entry.score += weight
      artistMap.set(key, entry)
    }

    const haystack = `${event?.songName || ''} ${artist}`
    for (const tag of matchLexiconTags(haystack)) {
      const entry = tagMap.get(tag) || { value: tag, score: 0 }
      entry.score += weight
      tagMap.set(tag, entry)
    }
  }

  const pick = (map) =>
    Array.from(map.values())
      .filter((item) => item.score !== 0)
      .sort((a, b) => b.score - a.score || (a.value < b.value ? -1 : 1))
      .slice(0, 12)

  return {
    artists: pick(artistMap),
    tags: pick(tagMap)
  }
}
