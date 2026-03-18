<template>
  <div class="my-music">
    <!-- 顶部横幅 -->
    <div class="hero-banner">
      <div class="banner-content">
        <div class="banner-left">
          <h1 class="banner-title">
            <icon-music :size="28" class="title-icon" />
            我的音乐
          </h1>
          <div class="banner-stats">
            <span class="stat-badge">{{ currentMusicList.length }} 首</span>
            <span class="stat-divider">·</span>
            <span class="stat-text">{{ artistCount }} 位艺术家</span>
          </div>
        </div>
        <div class="banner-actions">
          <a-button
            v-if="activeTab === 'local'"
            type="primary"
            size="medium"
            class="primary-btn"
            @click="handleImportMusic"
          >
            <template #icon>
              <icon-plus :size="18" />
            </template>
            导入
          </a-button>
          <a-button size="medium" class="secondary-btn" @click="handleRefresh">
            <template #icon>
              <icon-refresh :size="18" />
            </template>
          </a-button>
        </div>
      </div>
    </div>

    <!-- 标签页 -->
    <div class="tabs-container">
      <a-tabs v-model:active-key="activeTab" type="rounded" size="large">
        <a-tab-pane key="local" title="本地音乐">
          <template #icon>
            <icon-folder />
          </template>
        </a-tab-pane>
        <a-tab-pane key="downloaded" title="已下载">
          <template #icon>
            <icon-download />
          </template>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 控制栏 -->
    <div class="control-bar">
      <a-input-search
        v-model="filterKeyword"
        placeholder="搜索歌曲、艺术家..."
        allow-clear
        class="search-box"
      >
        <template #prefix>
          <icon-search :size="16" />
        </template>
      </a-input-search>
      <a-select
        v-model="sortBy"
        class="sort-select"
        :trigger-props="{ contentClass: 'sort-dropdown' }"
      >
        <a-option value="name">名称</a-option>
        <a-option value="artist">艺术家</a-option>
        <a-option value="album">专辑</a-option>
        <a-option value="addTime">添加时间</a-option>
      </a-select>
    </div>

    <!-- 歌曲列表区域 -->
    <div class="songs-container">
      <div v-if="filteredMusicList.length > 0" class="songs-wrapper">
        <!-- 表头 -->
        <div class="table-header">
          <div class="th th-index">#</div>
          <div class="th th-title">标题</div>
          <div class="th th-artist">艺术家</div>
          <div class="th th-album">专辑</div>
          <div class="th th-duration">时长</div>
          <div class="th th-actions"></div>
        </div>

        <!-- 歌曲列表 -->
        <div class="songs-list">
          <div
            v-for="(song, index) in filteredMusicList"
            :key="song.id"
            class="song-row"
            :class="{
              'is-playing': currentSong?.id === song.id,
              'is-active': currentSong?.id === song.id && isPlaying
            }"
            @click="handlePlayMusic(song)"
          >
            <!-- 序号 / 播放按钮 -->
            <div class="td td-index">
              <span class="row-number">{{ index + 1 }}</span>
              <div class="play-icon-wrapper">
                <icon-play-arrow-fill v-if="currentSong?.id !== song.id" :size="16" />
                <icon-sound-fill v-else :size="16" class="sound-wave" />
              </div>
            </div>

            <!-- 标题 -->
            <div class="td td-title">
              <div class="title-content">
                <span class="song-title" :title="song.name">{{ song.name }}</span>
              </div>
            </div>

            <!-- 艺术家 -->
            <div class="td td-artist">
              <span class="artist-name" :title="song.artist">
                {{ song.artist || '未知艺术家' }}
              </span>
            </div>

            <!-- 专辑 -->
            <div class="td td-album">
              <span class="album-name" :title="song.album">
                {{ song.album || '未知专辑' }}
              </span>
            </div>

            <!-- 时长 -->
            <div class="td td-duration">
              <span class="duration-text">{{ song.duration || '--:--' }}</span>
            </div>

            <!-- 操作按钮 -->
            <div class="td td-actions">
              <div class="action-buttons">
                <a-button
                  type="text"
                  size="mini"
                  class="action-btn"
                  @click.stop="handleAddToPlaylist(song)"
                >
                  <template #icon>
                    <icon-plus :size="18" />
                  </template>
                </a-button>
                <a-button
                  type="text"
                  size="mini"
                  status="danger"
                  class="action-btn delete-btn"
                  @click.stop="handleDelete(song)"
                >
                  <template #icon>
                    <icon-delete :size="18" />
                  </template>
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-container">
        <div class="empty-content">
          <icon-music :size="64" class="empty-icon" />
          <h3 class="empty-title">暂无音乐</h3>
          <p class="empty-desc">导入音乐开始聆听</p>
          <a-button type="primary" size="large" class="empty-action-btn" @click="handleImportMusic">
            <template #icon>
              <icon-plus :size="18" />
            </template>
            导入音乐
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { importMusicFromLocal, saveMusicListToLocal, loadMusicListFromLocal } from './my-music-api'
import { formatDuration } from '@/utils/utils'
import {
  IconPlus,
  IconRefresh,
  IconMusic,
  IconFolder,
  IconSearch,
  IconPlayArrowFill,
  IconDelete,
  IconSoundFill,
  IconDownload
} from '@arco-design/web-vue/es/icon'

const songStore = useSongStore()
const { currentSong, isPlaying } = storeToRefs(songStore)

const activeTab = ref('local')
const musicList = ref([])
const downloadedList = ref([])
const filterKeyword = ref('')
const sortBy = ref('name')
const isLoading = ref(false)

const currentMusicList = computed(() => {
  return activeTab.value === 'local' ? musicList.value : downloadedList.value
})

const artistCount = computed(() => {
  return new Set(currentMusicList.value.map((item) => item.artist)).size
})

const filteredMusicList = computed(() => {
  let list = [...currentMusicList.value]

  if (filterKeyword.value) {
    const keyword = filterKeyword.value.toLowerCase()
    list = list.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.artist.toLowerCase().includes(keyword) ||
        item.album.toLowerCase().includes(keyword)
    )
  }

  list.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name, 'zh-CN')
      case 'artist':
        return a.artist.localeCompare(b.artist, 'zh-CN')
      case 'album':
        return a.album.localeCompare(b.album, 'zh-CN')
      case 'addTime':
        return new Date(b.addTime) - new Date(a.addTime)
      default:
        return 0
    }
  })

  return list
})

const handleImportMusic = async () => {
  try {
    isLoading.value = true
    const importedFiles = await importMusicFromLocal()

    if (importedFiles.length === 0) {
      Message.info('未选择任何文件')
      return
    }

    musicList.value.push(...importedFiles)
    saveMusicListToLocal(musicList.value)
    Message.success(`成功导入 ${importedFiles.length} 首歌曲`)
  } catch (error) {
    console.error('导入音乐失败:', error)
    Message.error('导入音乐失败，请重试')
  } finally {
    isLoading.value = false
  }
}

const handleRefresh = async () => {
  if (activeTab.value === 'local') {
    musicList.value = loadMusicListFromLocal()
    Message.success('刷新成功')
  } else {
    await loadDownloadedSongs()
  }
}

const loadDownloadedSongs = async () => {
  try {
    const result = await window.api.getDownloadedSongs()
    if (result.success) {
      downloadedList.value = result.songs.map((song) => {
        const durationMs = song.durationMs || song.dt || null
        const duration = song.duration || (durationMs ? formatDuration(durationMs) : '--:--')
        return { ...song, duration, durationMs }
      })
      Message.success('已下载列表刷新成功')
    }
  } catch (error) {
    console.error('加载已下载列表失败:', error)
    Message.error('加载已下载列表失败')
  }
}

const handlePlayMusic = async (song) => {
  try {
    // 本地音乐或已下载音乐直接使用文件路径
    const songToPlay = {
      ...song,
      url: song.path // 使用本地文件路径
    }
    songStore.play(songToPlay)
  } catch (error) {
    console.error('播放音乐失败:', error)
    Message.error('播放失败，请重试')
  }
}

const handleAddToPlaylist = (row) => {
  const songToAdd = {
    ...row,
    url: row.path
  }
  songStore.addToPlaylist(songToAdd)
  Message.success(`已添加到播放列表: ${row.name}`)
}

const handleDelete = (row) => {
  const title = activeTab.value === 'local' ? '删除' : '从列表中移除'
  const contentText =
    activeTab.value === 'local'
      ? `确定要删除 "${row.name}" 吗?`
      : `确定要从已下载列表中移除 "${row.name}" 吗?`

  const deleteSource = ref(false)

  Modal.confirm({
    title: title,
    content: () =>
      h('div', [
        h('div', contentText),
        h(
          'label',
          {
            style:
              'display:flex;align-items:center;gap:8px;margin-top:8px;color:var(--color-text-2);'
          },
          [
            h('input', {
              type: 'checkbox',
              onChange: (e) => {
                deleteSource.value = e.target.checked
              }
            }),
            '同时删除源文件'
          ]
        )
      ]),
    onOk: async () => {
      try {
        if (deleteSource.value) {
          if (row.path) {
            const result = await window.api.deleteFile(row.path)
            if (!result.success) {
              Message.error(result.error || '删除文件失败')
              return
            }
          } else {
            Message.warning('未找到源文件路径')
          }
        }

        if (activeTab.value === 'local') {
          const index = musicList.value.findIndex((item) => item.id === row.id)
          if (index > -1) {
            musicList.value.splice(index, 1)
            saveMusicListToLocal(musicList.value)
          }
          Message.success('删除成功')
        } else {
          await window.api.removeDownloadedSong(row.id)
          await loadDownloadedSongs()
          Message.success('移除成功')
        }
      } catch (error) {
        console.error('删除失败:', error)
        Message.error('删除失败')
      }
    }
  })
}

onMounted(async () => {
  if (window.api) {
    console.log('✅ Electron API 可用')
  } else {
    Message.warning('当前环境不支持导入本地音乐功能')
  }

  musicList.value = loadMusicListFromLocal()
  await loadDownloadedSongs()
})
</script>

<style scoped lang="scss">
@import './my-music.scss';
</style>
