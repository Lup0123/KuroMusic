import Store from 'electron-store'
import { randomBytes } from 'crypto'

const StoreConstructor = Store.default || Store

const store = new StoreConstructor({
  name: 'music-player-device-config',
  defaults: {
    deviceId: ''
  }
})

// 与网易云客户端一致的 52 位大写十六进制设备 ID
const DEVICE_ID_PATTERN = /^[0-9A-F]{52}$/

const deviceConfig = {
  // 获取固定的设备 ID：首次生成后持久化，之后保持不变（频繁变化的设备 ID 更容易触发风控）
  getDeviceId() {
    const saved = store.get('deviceId', '')
    if (DEVICE_ID_PATTERN.test(saved)) return saved
    const deviceId = randomBytes(26).toString('hex').toUpperCase()
    store.set('deviceId', deviceId)
    return deviceId
  }
}

export { deviceConfig }
