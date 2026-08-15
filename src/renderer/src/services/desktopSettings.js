// 桌面能力设置：开机自启与关闭最小化到托盘（由主进程执行系统级操作）
const DEFAULT_CLOSE_TO_TRAY = true

/** 读取「关闭时最小化到托盘」偏好（默认开启） */
export function readCloseToTray(settings = {}) {
  return settings.closeToTray !== false
}

/** 把「关闭时最小化到托盘」偏好同步给主进程 */
export function syncCloseToTray(settings = {}) {
  const api = globalThis?.window?.api
  if (typeof api?.setCloseToTray !== 'function') return false
  api.setCloseToTray(readCloseToTray(settings))
  return true
}

/** 应用启动时根据已存设置同步一次 */
export function syncCloseToTrayFromStoredSettings() {
  let settings = {}
  try {
    settings = JSON.parse(globalThis.localStorage?.getItem('appSettings') || '{}')
  } catch {
    settings = {}
  }
  return syncCloseToTray(settings)
}

/** 设置开机自启（Windows / macOS 支持） */
export async function applyAutoLaunch(enabled) {
  const api = globalThis?.window?.api
  if (typeof api?.setAutoLaunch !== 'function') return null
  try {
    return await api.setAutoLaunch(Boolean(enabled))
  } catch (error) {
    console.error('开机自启设置失败:', error)
    return null
  }
}

/** 查询系统当前的开机自启状态 */
export async function fetchAutoLaunchStatus() {
  const api = globalThis?.window?.api
  if (typeof api?.getAutoLaunch !== 'function') return null
  try {
    return await api.getAutoLaunch()
  } catch {
    return null
  }
}


const DEFAULT_AUTO_CHECK_UPDATE = true

/** 读取「自动检查更新」偏好（默认开启） */
export function readAutoCheckUpdate(settings = {}) {
  return settings.autoCheckUpdate !== false
}

/** 把「自动检查更新」偏好同步给主进程 */
export function syncAutoCheckUpdate(settings = {}) {
  const api = globalThis?.window?.api
  if (typeof api?.setAutoCheckUpdate !== 'function') return false
  api.setAutoCheckUpdate(readAutoCheckUpdate(settings))
  return true
}

/** 应用启动时根据已存设置同步一次 */
export function syncAutoCheckUpdateFromStoredSettings() {
  let settings = {}
  try {
    settings = JSON.parse(globalThis.localStorage?.getItem('appSettings') || '{}')
  } catch {
    settings = {}
  }
  return syncAutoCheckUpdate(settings)
}

export { DEFAULT_AUTO_CHECK_UPDATE, DEFAULT_CLOSE_TO_TRAY }