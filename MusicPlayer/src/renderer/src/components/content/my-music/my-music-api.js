/**
 * 音乐导入相关 API
 */

/**
 * 打开文件选择对话框并导入音乐
 * @returns {Promise<Array>} 导入的音乐文件信息数组
 */
export const importMusicFromLocal = async () => {
  if (!window.electronAPI) {
    throw new Error('Electron API 不可用')
  }

  try {
    const result = await window.api.selectMusicFiles()

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return []
    }

    const musicFiles = []

    for (const filePath of result.filePaths) {
      try {
        const metadata = await window.api.getMusicMetadata(filePath)

        const fileName = filePath.split('\\').pop().split('/').pop()
        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '')

        musicFiles.push({
          id: Date.now() + Math.random(),
          name: metadata.title || nameWithoutExt,
          artist: metadata.artist || '未知艺术家',
          album: metadata.album || '未知专辑',
          duration: formatDuration(metadata.duration),
          cover: metadata.picture || 'https://via.placeholder.com/50',
          // 修复路径格式 - 直接使用原始路径
          path: filePath,
          addTime: new Date().toISOString()
        })
      } catch (error) {
        console.error(`处理文件失败: ${filePath}`, error)
      }
    }

    return musicFiles
  } catch (error) {
    console.error('导入音乐失败:', error)
    throw error
  }
}

// 格式化时长
const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`
}

// 保存音乐列表到本地存储
export const saveMusicListToLocal = (musicList) => {
  localStorage.setItem('musicList', JSON.stringify(musicList))
}

// 从本地存储加载音乐列表
export const loadMusicListFromLocal = () => {
  const saved = localStorage.getItem('musicList')
  return saved ? JSON.parse(saved) : []
}
