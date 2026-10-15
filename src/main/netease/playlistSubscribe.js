// 收藏 / 取消收藏网易云歌单的请求参数。
//
// 不直接用库自带的 playlist_subscribe：它以 os=pc 身份发 eapi 请求，并强制附带库里写死的
// 过期 X-antiCheatToken，网易云风控会直接返回 405「操作过于频繁」。
// 这里改走库的通用 api 透传：使用 iPhone 客户端身份、不带 checkToken，请求体只有 id。
// 参考 https://github.com/nonhana/hana-music-api/issues/32

const IPHONE_IDENTITY = {
  os: 'iPhone OS',
  appver: '9.0.90',
  osver: '16.2',
  channel: 'distribution'
}

// 解析 "k=v; k2=v2" 形式的 cookie；值里可能含 "="，只按第一个 "=" 切分
export function parseCookie(cookie) {
  if (!cookie) return {}
  if (typeof cookie === 'object') return { ...cookie }
  const result = {}
  for (const part of String(cookie).split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    if (key) result[key] = part.slice(index + 1).trim()
  }
  return result
}

export function buildSubscribeRequest({ cookie, playlistId, subscribe, deviceId }) {
  return {
    uri: subscribe ? '/api/playlist/subscribe' : '/api/playlist/unsubscribe',
    crypto: 'eapi',
    data: { id: playlistId },
    cookie: {
      ...parseCookie(cookie),
      ...IPHONE_IDENTITY,
      ...(deviceId ? { deviceId } : {})
    },
    timestamp: Date.now()
  }
}
