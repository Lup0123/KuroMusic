import Store from 'electron-store'

const StoreConstructor = Store.default || Store

// 界面缩放档位（主窗口与 AI 窗口共用）
const UI_ZOOM_LEVELS = [0.9, 1, 1.1, 1.25]
const DEFAULT_ZOOM_FACTOR = 1

const store = new StoreConstructor({
  name: 'music-player-ui-config',
  defaults: {
    zoomFactor: DEFAULT_ZOOM_FACTOR
  }
})

const normalizeZoomFactor = (value) => {
  const numeric = Number(value)
  return UI_ZOOM_LEVELS.includes(numeric) ? numeric : DEFAULT_ZOOM_FACTOR
}

const uiConfig = {
  getZoomFactor() {
    return normalizeZoomFactor(store.get('zoomFactor', DEFAULT_ZOOM_FACTOR))
  },

  setZoomFactor(value) {
    const factor = normalizeZoomFactor(value)
    store.set('zoomFactor', factor)
    return factor
  },

  // 按档位步进：direction 为 1 放大 / -1 缩小，到头保持不变
  stepZoomFactor(direction) {
    const index = UI_ZOOM_LEVELS.indexOf(this.getZoomFactor())
    const next = Math.min(UI_ZOOM_LEVELS.length - 1, Math.max(0, index + direction))
    return this.setZoomFactor(UI_ZOOM_LEVELS[next])
  }
}

export { uiConfig, UI_ZOOM_LEVELS }
