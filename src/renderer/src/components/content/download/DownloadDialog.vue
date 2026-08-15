<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="下载歌曲"
    :style="{ width: '480px' }"
    :mask-closable="false"
  >
    <div class="download-dialog">
      <!-- 歌曲信息 -->
      <div class="song-info-section">
        <n-image
          :src="songInfo.cover"
          width="80"
          height="80"
          object-fit="cover"
          :preview-disabled="true"
          style="border-radius: 8px"
        />
        <div class="song-details">
          <div class="song-name">{{ songInfo.name }}</div>
          <div class="song-meta">
            <span>{{ songInfo.artist }}</span>
            <n-divider vertical />
            <span>{{ songInfo.album }}</span>
          </div>
        </div>
      </div>

      <n-divider />

      <!-- 音质选择 -->
      <div class="quality-section">
        <div class="section-title">
          <n-icon size="18"><MusicalNotesOutline /></n-icon>
          音质选择
        </div>
        <n-radio-group v-model:value="selectedQuality" class="quality-options">
          <n-space vertical>
            <n-radio value="standard">
              <div class="quality-option">
                <span class="quality-name">标准品质</span>
                <n-tag size="small">128kbps</n-tag>
              </div>
            </n-radio>
            <n-radio value="higher">
              <div class="quality-option">
                <span class="quality-name">较高品质</span>
                <n-tag size="small" type="info">192kbps</n-tag>
              </div>
            </n-radio>
            <n-radio value="exhigh">
              <div class="quality-option">
                <span class="quality-name">极高品质</span>
                <n-tag size="small" type="info">320kbps</n-tag>
              </div>
            </n-radio>
            <n-radio value="lossless">
              <div class="quality-option">
                <span class="quality-name">无损品质</span>
                <n-tag size="small" type="success">FLAC</n-tag>
              </div>
            </n-radio>
            <n-radio value="hires">
              <div class="quality-option">
                <span class="quality-name">Hi-Res</span>
                <n-tag size="small" type="warning">高解析度</n-tag>
              </div>
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <n-divider />

      <!-- 下载路径 -->
      <div class="path-section">
        <div class="section-title">
          <n-icon size="18"><FolderOutline /></n-icon>
          下载路径
        </div>
        <div class="path-display">
          <n-input-group>
            <n-input :value="downloadPath" readonly placeholder="请在设置中选择下载路径" />
            <n-button @click="selectPath">选择</n-button>
          </n-input-group>
        </div>
      </div>
    </div>

    <template #footer>
      <n-space justify="end">
        <n-button @click="handleCancel">取消</n-button>
        <n-button type="primary" :loading="downloading" @click="handleDownload">下载</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import { MusicalNotesOutline, FolderOutline } from '@vicons/ionicons5'

const message = useMessage()

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  songInfo: {
    type: Object,
    default: () => ({
      id: '',
      name: '',
      artist: '',
      album: '',
      cover: ''
    })
  }
})

const emit = defineEmits(['update:modelValue', 'download-complete'])

const visible = ref(props.modelValue)
const downloading = ref(false)
const selectedQuality = ref('exhigh')
const downloadPath = ref('')

watch(
  () => props.modelValue,
  (val) => {
    visible.value = val
    if (val) {
      // 从设置中读取下载路径
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
      downloadPath.value = settings.downloadPath || ''
      // 从设置中读取默认音质
      selectedQuality.value = settings.quality || 'exhigh'
    }
  }
)

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const selectPath = async () => {
  try {
    const result = await window.api.selectDownloadDirectory()
    if (result.success && result.path) {
      downloadPath.value = result.path
      // 保存到设置
      const settings = JSON.parse(localStorage.getItem('appSettings') || '{}')
      settings.downloadPath = result.path
      localStorage.setItem('appSettings', JSON.stringify(settings))
      message.success('下载路径已更新')
    }
  } catch (error) {
    console.error('选择路径失败:', error)
    message.error('选择路径失败')
  }
}

const handleDownload = async () => {
  if (!downloadPath.value) {
    message.warning('请先选择下载路径')
    return
  }

  if (!props.songInfo.id) {
    message.warning('歌曲信息不完整')
    return
  }

  try {
    downloading.value = true

    // 获取下载 URL
    const response = await window.api.getSongDownloadUrl(props.songInfo.id, selectedQuality.value)

    console.log('获取下载URL响应:', response)
    if (!response || !response.body || !response.body.data) {
      message.error('获取下载地址失败')
      downloading.value = false
      return
    }

    const downloadUrl = response.body.data.url
    if (!downloadUrl) {
      message.error('无法获取下载地址，可能该音质不可用')
      downloading.value = false
      return
    }

    // 构建文件名
    const ext = response.body.data.type || 'mp3'
    const fileName = `${props.songInfo.name} - ${props.songInfo.artist}.${ext}`.replace(
      /[\\/:*?"<>|]/g,
      '_'
    )

    // 下载文件
    const result = await window.api.downloadSong(downloadUrl, downloadPath.value, fileName)

    if (result.success) {
      // 保存下载记录
      const songRecord = {
        id: props.songInfo.id,
        name: props.songInfo.name,
        artist: props.songInfo.artist,
        album: props.songInfo.album,
        cover: props.songInfo.cover,
        path: result.path,
        quality: selectedQuality.value,
        downloadTime: new Date().toISOString(),
        size: response.body.data.size,
        type: ext
      }

      await window.api.saveDownloadedSong(songRecord)

      message.success('下载成功！')
      emit('download-complete', songRecord)
      visible.value = false
    } else {
      message.error('下载失败: ' + result.error)
    }
  } catch (error) {
    console.error('下载失败:', error)
    message.error('下载失败: ' + error.message)
  } finally {
    downloading.value = false
  }
}

const handleCancel = () => {
  visible.value = false
}
</script>

<style scoped lang="scss">
.download-dialog {
  .song-info-section {
    display: flex;
    gap: 16px;
    align-items: center;

    .song-details {
      flex: 1;

      .song-name {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .song-meta {
        font-size: 13px;
        opacity: 0.6;
      }
    }
  }

  .quality-section,
  .path-section {
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .quality-options {
      width: 100%;

      .quality-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 300px;

        .quality-name {
          font-size: 14px;
        }
      }
    }
  }
}
</style>
