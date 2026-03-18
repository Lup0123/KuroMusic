import { Message } from '@arco-design/web-vue'
import { formatDuration } from '@/utils/utils'

/**
 * 下载单个歌曲
 * @param {Object} song - 歌曲信息
 * @param {Function} onProgress - 进度回调（可选）
 * @returns {Promise<boolean>} - 是否下载成功
 */
export async function downloadSong(song, onProgress) {
  try {
    // 检查是否为本地音乐
    if (song.url || song.path) {
      Message.warning('本地音乐无需下载')
      return false
    }

    // 获取下载配置
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
    const downloadPath = settings.downloadPath
    const quality = settings.quality || 'exhigh'

    if (!downloadPath) {
      Message.warning('请先在设置中选择下载路径')
      return false
    }

    // 显示下载开始提示
    const loadingMessage = Message.loading({
      content: `正在下载：${song.name}`,
      duration: 0
    })

    try {
      // 获取下载URL
      const response = await window.api.getSongDownloadUrl(song.id, quality)

      if (!response || !response.body || !response.body.data) {
        throw new Error('获取下载地址失败')
      }

      const downloadUrl = response.body.data.url
      if (!downloadUrl) {
        throw new Error('该音质不可用，请尝试其他音质')
      }

      // 构建文件名
      const ext = response.body.data.type || 'mp3'
      const fileName = `${song.name} - ${song.artist}.${ext}`.replace(/[\\/:*?"<>|]/g, '_')

      // 下载文件
      const result = await window.api.downloadSong(downloadUrl, downloadPath, fileName)

      if (!result.success) {
        throw new Error(result.error || '下载失败')
      }

      const durationMs = song.durationMs || song.dt || null
      const duration = song.duration || (durationMs ? formatDuration(durationMs) : '--:--')

      // 保存下载记录
      const songRecord = {
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        cover: song.cover,
        path: result.path,
        duration,
        durationMs,
        quality: quality,
        downloadTime: new Date().toISOString(),
        size: response.body.data.size,
        type: ext
      }

      await window.api.saveDownloadedSong(songRecord)

      // 关闭loading并显示成功提示
      loadingMessage.close()
      Message.success(`下载成功：${song.name}`)

      if (onProgress) {
        onProgress({ song, success: true })
      }

      return true
    } catch (error) {
      loadingMessage.close()
      throw error
    }
  } catch (error) {
    console.error('下载失败:', error)
    Message.error(`下载失败：${error.message}`)

    if (onProgress) {
      onProgress({ song, success: false, error: error.message })
    }

    return false
  }
}

/**
 * 批量下载歌曲
 * @param {Array} songs - 歌曲列表
 * @param {Function} onProgress - 进度回调（可选）
 * @returns {Promise<Object>} - 下载结果统计
 */
export async function downloadSongs(songs, onProgress) {
  if (!songs || songs.length === 0) {
    Message.warning('没有可下载的歌曲')
    return { success: 0, failed: 0, total: 0 }
  }

  // 检查下载路径
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
  if (!settings.downloadPath) {
    Message.warning('请先在设置中选择下载路径')
    return { success: 0, failed: 0, total: 0 }
  }

  let successCount = 0
  let failedCount = 0
  const total = songs.length

  // 显示批量下载提示
  const notification = Message.info({
    content: `准备下载 ${total} 首歌曲...`,
    duration: 0
  })

  for (let i = 0; i < songs.length; i++) {
    const song = songs[i]

    // 更新进度提示
    notification.close()
    const progressNotification = Message.loading({
      content: `正在下载 (${i + 1}/${total})：${song.name}`,
      duration: 0
    })

    const success = await downloadSong(song, (result) => {
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          song: result.song,
          success: result.success
        })
      }
    })

    progressNotification.close()

    if (success) {
      successCount++
    } else {
      failedCount++
    }

    // 添加延迟避免请求过快
    if (i < songs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // 显示最终结果
  if (failedCount === 0) {
    Message.success(`全部下载完成！共 ${successCount} 首`)
  } else {
    Message.warning(`下载完成：成功 ${successCount} 首，失败 ${failedCount} 首`)
  }

  return { success: successCount, failed: failedCount, total }
}
