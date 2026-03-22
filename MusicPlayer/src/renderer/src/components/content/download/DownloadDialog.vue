<template>
  <a-modal
    v-model:visible="visible"
    title="下载歌曲"
    :ok-loading="downloading"
    ok-text="下载"
    cancel-text="取消"
    width="480px"
    @ok="handleDownload"
    @cancel="handleCancel"
  >
    <div class="download-dialog">
      <!-- 歌曲信息 -->
      <div class="song-info-section">
        <a-image
          :src="songInfo.cover"
          :width="80"
          :height="80"
          style="border-radius: 8px"
          preview="false"
        />
        <div class="song-details">
          <div class="song-name">{{ songInfo.name }}</div>
          <div class="song-meta">
            <span>{{ songInfo.artist }}</span>
            <a-divider direction="vertical" />
            <span>{{ songInfo.album }}</span>
          </div>
        </div>
      </div>

      <a-divider />

      <!-- 音质选择 -->
      <div class="quality-section">
        <div class="section-title">
          <icon-music :size="18" />
          音质选择
        </div>
        <a-radio-group v-model="selectedQuality" direction="vertical" class="quality-options">
          <a-radio value="standard">
            <div class="quality-option">
              <span class="quality-name">标准品质</span>
              <a-tag color="gray" size="small">128kbps</a-tag>
            </div>
          </a-radio>
          <a-radio value="higher">
            <div class="quality-option">
              <span class="quality-name">较高品质</span>
              <a-tag color="blue" size="small">192kbps</a-tag>
            </div>
          </a-radio>
          <a-radio value="exhigh">
            <div class="quality-option">
              <span class="quality-name">极高品质</span>
              <a-tag color="arcoblue" size="small">320kbps</a-tag>
            </div>
          </a-radio>
          <a-radio value="lossless">
            <div class="quality-option">
              <span class="quality-name">无损品质</span>
              <a-tag color="green" size="small">FLAC</a-tag>
            </div>
          </a-radio>
          <a-radio value="hires">
            <div class="quality-option">
              <span class="quality-name">Hi-Res</span>
              <a-tag color="gold" size="small">高解析度</a-tag>
            </div>
          </a-radio>
        </a-radio-group>
      </div>

      <a-divider />

      <!-- 下载路径 -->
      <div class="path-section">
        <div class="section-title">
          <icon-folder :size="18" />
          下载路径
        </div>
        <div class="path-display">
          <a-input :model-value="downloadPath" readonly placeholder="请在设置中选择下载路径">
            <template #suffix>
              <a-button type="text" size="small" @click="selectPath"> 选择 </a-button>
            </template>
          </a-input>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { IconMusic, IconFolder } from '@arco-design/web-vue/es/icon'

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
      Message.success('下载路径已更新')
    }
  } catch (error) {
    console.error('选择路径失败:', error)
    Message.error('选择路径失败')
  }
}

const handleDownload = async () => {
  if (!downloadPath.value) {
    Message.warning('请先选择下载路径')
    return
  }

  if (!props.songInfo.id) {
    Message.warning('歌曲信息不完整')
    return
  }

  try {
    downloading.value = true

    // 获取下载 URL
    const response = await window.api.getSongDownloadUrl(props.songInfo.id, selectedQuality.value)

    console.log('获取下载URL响应:', response)
    if (!response || !response.body || !response.body.data) {
      Message.error('获取下载地址失败')
      downloading.value = false
      return
    }

    const downloadUrl = response.body.data.url
    if (!downloadUrl) {
      Message.error('无法获取下载地址，可能该音质不可用')
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

      Message.success('下载成功！')
      emit('download-complete', songRecord)
      visible.value = false
    } else {
      Message.error('下载失败: ' + result.error)
    }
  } catch (error) {
    console.error('下载失败:', error)
    Message.error('下载失败: ' + error.message)
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
  padding: 12px 0;

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
        color: var(--color-text-1);
      }

      .song-meta {
        font-size: 13px;
        color: var(--color-text-3);
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
      color: var(--color-text-1);
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

    .path-display {
      :deep(.arco-input-wrapper) {
        background-color: var(--color-fill-2);
      }
    }
  }
}
</style>
