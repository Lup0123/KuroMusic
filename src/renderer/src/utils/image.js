export function normalizeCoverUrl(url, size = 200) {
  if (!url || typeof url !== 'string') return ''

  const trimmed = url.trim()
  if (!trimmed) return ''

  // via.placeholder.com 服务已下线，历史数据里的占位链接会导致裂图；
  // 统一判空，交给上层组件（AppCover 等）显示本地兜底占位。
  if (/placeholder\.com/i.test(trimmed)) return ''

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
