export function normalizeCoverUrl(url, size = 200) {
  if (!url || typeof url !== 'string') return ''

  const trimmed = url.trim()
  if (!trimmed) return ''

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:') ||
    /^[A-Za-z]:\\/.test(trimmed)
  ) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:'
    }

    if (parsed.hostname.includes('music.126.net') && !parsed.searchParams.has('param')) {
      parsed.searchParams.set('param', `${size}y${size}`)
    }

    return parsed.toString()
  } catch {
    return trimmed
  }
}
