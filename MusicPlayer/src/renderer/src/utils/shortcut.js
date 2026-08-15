// 快捷键工具：将浏览器 keydown 事件转换为 Electron 加速键字符串
// 参考 Electron Accelerator 语法：https://www.electronjs.org/docs/latest/api/accelerator
const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || '')

// 允许不带修饰键单独使用的功能键（媒体键 / 音量键 / F 键）
const STANDALONE_ALLOWED_KEYS = new Set([
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
  'F13','F14','F15','F16','F17','F18','F19','F20','F21','F22','F23','F24',
  'MediaPlayPause','MediaNextTrack','MediaPreviousTrack','MediaStop',
  'VolumeUp','VolumeDown','VolumeMute'
])

const MEDIA_CODE_MAP = {
  MediaPlayPause: 'MediaPlayPause',
  MediaTrackNext: 'MediaNextTrack',
  MediaTrackPrevious: 'MediaPreviousTrack',
  MediaStop: 'MediaStop',
  VolumeUp: 'VolumeUp',
  VolumeDown: 'VolumeDown',
  VolumeMute: 'VolumeMute'
}

const KEY_CODE_MAP = {
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  CapsLock: 'Capslock',
  Escape: 'Escape'
}

const DISPLAY_MAP = {
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Space: '空格',
  Super: 'Win'
}
if (IS_MAC) {
  DISPLAY_MAP.Command = '⌘'
  DISPLAY_MAP.Control = '⌃'
  DISPLAY_MAP.Alt = '⌥'
  DISPLAY_MAP.Shift = '⇧'
}

function resolveKey(event) {
  const code = event.code || ''
  const keyLetter = /^Key([A-Z])$/.exec(code)
  if (keyLetter) return keyLetter[1]
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]
  const funcKey = /^F([1-9]|1[0-9]|2[0-4])$/.exec(code)
  if (funcKey) return `F${funcKey[1]}`
  if (MEDIA_CODE_MAP[code]) return MEDIA_CODE_MAP[code]
  if (KEY_CODE_MAP[code]) return KEY_CODE_MAP[code]
  return null
}

/**
 * 把 keydown 事件转为 Electron 加速键字符串。
 * 规则：需要至少一个修饰键；媒体/音量/F 键可单独使用；纯修饰键或标点返回 null。
 */
export function keydownToAccelerator(event) {
  const parts = []
  if (event.ctrlKey) parts.push(IS_MAC ? 'Control' : 'Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push(IS_MAC ? 'Command' : 'Super')
  const key = resolveKey(event)
  if (!key) return null
  if (parts.length === 0 && !STANDALONE_ALLOWED_KEYS.has(key)) return null
  parts.push(key)
  return parts.join('+')
}

/** 把加速键字符串格式化为可读展示文本 */
export function formatAccelerator(accelerator) {
  if (!accelerator || typeof accelerator !== 'string') return '未设置'
  return accelerator
    .split('+')
    .map((part) => DISPLAY_MAP[part] || part)
    .join('+')
}