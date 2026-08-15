// 全局快捷键：配置读取与同步（注册由主进程 globalShortcut 完成）
export const GLOBAL_SHORTCUT_COMMANDS = {
  'toggle-play': '播放 / 暂停',
  previous: '上一首',
  next: '下一首',
  'toggle-mini': '迷你模式'
}

export const DEFAULT_GLOBAL_SHORTCUTS = {
  'toggle-play': 'Ctrl+Alt+Space',
  previous: 'Ctrl+Alt+Left',
  next: 'Ctrl+Alt+Right',
  'toggle-mini': 'Ctrl+Alt+M'
}

/** 从应用设置中读取全局快捷键配置（缺省项回落到默认值） */
export function loadGlobalShortcutConfig(settings = {}) {
  const raw = settings.globalShortcuts || {}
  const shortcuts = {}
  for (const command of Object.keys(DEFAULT_GLOBAL_SHORTCUTS)) {
    const value = typeof raw[command] === 'string' ? raw[command].trim() : ''
    shortcuts[command] = value || DEFAULT_GLOBAL_SHORTCUTS[command]
  }
  return {
    enabled: settings.globalShortcutsEnabled !== false,
    shortcuts
  }
}

/** 读取 localStorage 中的应用设置 */
export function readStoredSettings() {
  try {
    const raw = globalThis.localStorage?.getItem('appSettings')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** 把当前设置同步到主进程注册全局快捷键，返回注册结果 */
export async function syncGlobalShortcuts(settings = {}) {
  const api = globalThis?.window?.api
  if (typeof api?.registerGlobalShortcuts !== 'function') return null
  const { enabled, shortcuts } = loadGlobalShortcutConfig(settings)
  try {
    return await api.registerGlobalShortcuts({ enabled, shortcuts })
  } catch (error) {
    console.error('全局快捷键注册失败:', error)
    return null
  }
}

/** 应用启动时根据已存设置同步一次 */
export async function syncGlobalShortcutsFromStoredSettings() {
  return syncGlobalShortcuts(readStoredSettings())
}