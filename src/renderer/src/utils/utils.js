//时间戳转换年月日函数（支持时间戳和ISO字符串）
export function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  // 检查日期是否有效
  if (isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
//时间戳转换时分秒函数
export function formatTime(timestamp) {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function formatDuration(duration) {
  if (duration === null || duration === undefined || duration === '') return '--:--'
  if (typeof duration === 'string') return duration

  const totalSeconds = Math.floor(Number(duration) / 1000)
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--'

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
