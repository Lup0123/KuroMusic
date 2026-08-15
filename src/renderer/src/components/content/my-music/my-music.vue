<template>
  <div class="my-music">
    <!-- 顶部横幅 -->
    <div class="hero-banner">
      <div class="banner-content">
        <div class="banner-left">
          <h1 class="banner-title">
            <n-icon :size="28" class="title-icon">
              <HeadsetOutline />
            </n-icon>
            我的音乐
          </h1>
          <div class="banner-stats">
            <span class="stat-badge">{{ currentMusicList.length }} 首</span>
            <span class="stat-divider">·</span>
            <span class="stat-text">{{ artistCount }} 位艺术家</span>
          </div>
        </div>
        <div class="banner-actions">
          <n-button
            v-if="activeTab === 'local'"
            type="primary"
            class="primary-btn"
            @click="handleImportMusic"
          >
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            导入
          </n-button>
          <n-button class="secondary-btn" @click="handleRefresh">
            <template #icon>
              <n-icon><RefreshOutline /></n-icon>
            </template>
          </n-button>
        </div>
      </div>
    </div>

    <!-- 标签页 -->
    <div class="tabs-container">
      <n-tabs v-model:value="activeTab" type="line">
        <n-tab-pane name="local" tab="本地音乐">
          <template #tab>
            <n-icon :size="16"><FolderOutline /></n-icon>
            <span style="margin-left: 6px">本地音乐</span>
          </template>
        </n-tab-pane>
        <n-tab-pane name="downloaded" tab="已下载">
          <template #tab>
            <n-icon :size="16"><DownloadOutline /></n-icon>
            <span style="margin-left: 6px">已下载</span>
          </template>
        </n-tab-pane>
      </n-tabs>
    </div>

    <!-- 控制栏 -->
    <div class="control-bar">
      <n-input
        v-model:value="filterKeyword"
        placeholder="搜索歌曲、艺术家..."
        clearable
        class="search-box"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>
      <n-select v-model:value="sortBy" :options="sortOptions" class="sort-select" />
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
                <n-icon v-if="currentSong?.id !== song.id"><CaretForward /></n-icon>
                <n-icon v-else class="sound-wave"><VolumeHighOutline /></n-icon>
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
                <n-button
                  text
                  size="small"
                  class="action-btn"
                  @click.stop="handleAddToPlaylist(song)"
                >
                  <template #icon>
                    <n-icon><AddOutline /></n-icon>
                  </template>
                </n-button>
                <n-button
                  text
                  size="small"
                  class="action-btn delete-btn"
                  @click.stop="handleDelete(song)"
                >
                  <template #icon>
                    <n-icon><TrashOutline /></n-icon>
                  </template>
                </n-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-container">
        <div class="empty-content">
          <n-icon :size="64" class="empty-icon">
            <HeadsetOutline />
          </n-icon>
          <h3 class="empty-title">暂无音乐</h3>
          <p class="empty-desc">导入音乐开始聆听</p>
          <n-button type="primary" size="large" class="empty-action-btn" @click="handleImportMusic">
            <template #icon>
              <n-icon><AddOutline /></n-icon>
            </template>
            导入音乐
          </n-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, h } from 'vue'
import { useMessage, useDialog, NCheckbox } from 'naive-ui'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { importMusicFromLocal, saveMusicListToLocal, loadMusicListFromLocal } from './my-music-api'
import { formatDuration } from '@/utils/utils'
import {
  AddOutline,
  RefreshOutline,
  HeadsetOutline,
  FolderOutline,
  SearchOutline,
  CaretForward,
  TrashOutline,
  VolumeHighOutline,
  DownloadOutline
} from '@vicons/ionicons5'

const message = useMessage()
const dialog = useDialog()

const songStore = useSongStore()
const { currentSong, isPlaying } = storeToRefs(songStore)

const activeTab = ref('local')
const musicList = ref([])
const downloadedList = ref([])
const filterKeyword = ref('')
const sortBy = ref('name')
const isLoading = ref(false)

const sortOptions = [
  { label: '名称', value: 'name' },
  { label: '艺术家', value: 'artist' },
  { label: '专辑', value: 'album' },
  { label: '添加时间', value: 'addTime' }
]

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
      message.info('未选择任何文件')
      return
    }

    musicList.value.push(...importedFiles)
    saveMusicListToLocal(musicList.value)
    message.success(`成功导入 ${importedFiles.length} 首歌曲`)
  } catch (error) {
    console.error('导入音乐失败:', error)
    message.error('导入音乐失败，请重试')
  } finally {
    isLoading.value = false
  }
}

const handleRefresh = async () => {
  if (activeTab.value === 'local') {
    musicList.value = loadMusicListFromLocal()
    message.success('刷新成功')
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
      message.success('已下载列表刷新成功')
    }
  } catch (error) {
    console.error('加载已下载列表失败:', error)
    message.error('加载已下载列表失败')
  }
}

const handlePlayMusic = async (song) => {
  try {
    const songToPlay = {
      ...song,
      url: song.path
    }
    songStore.play(songToPlay)
  } catch (error) {
    console.error('播放音乐失败:', error)
    message.error('播放失败，请重试')
  }
}

const handleAddToPlaylist = (row) => {
  const songToAdd = {
    ...row,
    url: row.path
  }
  songStore.addToPlaylist(songToAdd)
  message.success(`已添加到播放列表: ${row.name}`)
}

const handleDelete = (row) => {
  const title = activeTab.value === 'local' ? '删除' : '从列表中移除'
  const contentText =
    activeTab.value === 'local'
      ? `确定要删除 "${row.name}" 吗？`
      : `确定要从已下载列表中移除 "${row.name}" 吗？`

  const deleteSource = ref(false)

  dialog.warning({
    title: title,
    content: () =>
      h('div', [
        h('div', contentText),
        h(
          'label',
          {
            style: 'display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer;'
          },
          [
            h(NCheckbox, {
              checked: deleteSource.value,
              onUpdateChecked: (val) => {
                deleteSource.value = val
              }
            }),
            '同时删除源文件'
          ]
        )
      ]),
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        if (deleteSource.value) {
          if (row.path) {
            const result = await window.api.deleteFile(row.path)
            if (!result.success) {
              message.error(result.error || '删除文件失败')
              return
            }
          } else {
            message.warning('未找到源文件路径')
          }
        }

        if (activeTab.value === 'local') {
          const index = musicList.value.findIndex((item) => item.id === row.id)
          if (index > -1) {
            musicList.value.splice(index, 1)
            saveMusicListToLocal(musicList.value)
          }
          message.success('删除成功')
        } else {
          await window.api.removeDownloadedSong(row.id)
          await loadDownloadedSongs()
          message.success('移除成功')
        }
      } catch (error) {
        console.error('删除失败:', error)
        message.error('删除失败')
      }
    }
  })
}

onMounted(async () => {
  if (window.api) {
    console.log('Electron API 可用')
  } else {
    message.warning('当前环境不支持导入本地音乐功能')
  }

  musicList.value = loadMusicListFromLocal()
  await loadDownloadedSongs()
})
</script>

<style scoped lang="scss">
.my-music {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--n-color);
  overflow: hidden;

  // ========== 顶部横幅 ==========
  .hero-banner {
    padding: 24px 32px;
    background: transparent;
    border-bottom: 1px solid var(--n-border-color);

    .banner-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1600px;
      margin: 0 auto;

      .banner-left {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .banner-title {
          font-size: 28px;
          font-weight: 700;
          color: var(--n-text-color);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 12px;
          letter-spacing: -0.5px;

          .title-icon {
            color: var(--n-primary-color);
          }
        }

        .banner-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--n-text-color-3);

          .stat-badge {
            background: rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.1);
            color: var(--n-primary-color);
            padding: 2px 10px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 12px;
          }

          .stat-divider {
            color: var(--n-text-color-disabled);
            margin: 0 4px;
          }

          .stat-text {
            font-weight: 500;
          }
        }
      }

      .banner-actions {
        display: flex;
        gap: 8px;

        .primary-btn {
          padding: 0 20px;
          height: 36px;
          font-size: 14px;
          font-weight: 500;
          border-radius: 8px;
          border: none;
          transition: all 0.2s ease;

          &:hover {
            background: var(--n-primary-color-hover);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.25);
          }

          &:active {
            transform: translateY(0);
          }
        }

        .secondary-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--n-hover-color);
          border: 1px solid var(--n-border-color);
          transition: all 0.2s ease;

          &:hover {
            background: var(--n-pressed-color);
            transform: rotate(90deg);
          }
        }
      }
    }
  }

  // ========== 标签页 ==========
  .tabs-container {
    padding: 0 32px;
    border-bottom: 1px solid var(--n-border-color);

    :deep(.ant-tabs) {
      .ant-tabs-nav {
        &::before {
          display: none;
        }
      }

      .ant-tabs-tab {
        font-weight: 500;
        padding: 12px 20px;

        &:hover {
          color: var(--n-primary-color);
        }

        &.ant-tabs-tab-active {
          color: var(--n-primary-color);
        }
      }

      .ant-tabs-tab-icon {
        margin-right: 6px;
      }
    }
  }

  // ========== 控制栏 ==========
  .control-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    padding: 16px 32px;
    background: transparent;
    max-width: 1600px;
    width: 100%;
    margin: 0 auto;
    gap: 12px;

    .search-box {
      flex: 1 1 360px;
      min-width: 240px;
      max-width: none;
      height: 36px;
      border-radius: 18px;
      border: 1px solid transparent;
      transition: all 0.2s ease;

      &:hover,
      &:focus-within {
        background: var(--n-card-color);
        border-color: var(--n-border-color);
      }

      :deep(.ant-input) {
        background: transparent;
        border: none;
        font-size: 13px;

        &::placeholder {
          color: var(--n-text-color-disabled);
        }
      }

      :deep(.ant-input-prefix) {
        color: var(--n-text-color-3);
      }
    }

    .sort-select {
      flex: 0 0 132px;
      width: 132px;
    }

    .sort-select {
      :deep(.ant-select-view) {
        width: 100%;
        height: 36px;
        border-radius: 18px;
        background: var(--n-hover-color);
        border: 1px solid transparent;
        transition: all 0.2s ease;

        &:hover {
          background: var(--n-card-color);
          border-color: var(--n-border-color);
        }
      }
    }
  }

  // ========== 歌曲列表区域 ==========
  .songs-container {
    flex: 1;
    overflow-y: auto;
    padding: 0 32px 32px;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--n-pressed-color);
      border-radius: 2px;

      &:hover {
        background: var(--n-pressed-color);
      }
    }

    .songs-wrapper {
      background: transparent;
      border-radius: 0;
      border: none;
      overflow: visible;

      // 表头
      .table-header {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        gap: 16px;
        background: transparent;
        border-bottom: 1px solid var(--n-border-color);
        color: var(--n-text-color-3);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(10px);
        background: color-mix(in srgb, var(--n-color) 90%, transparent);

        .th {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 4px;

          &.th-index {
            width: 40px;
            justify-content: center;
          }

          &.th-title {
            flex: 1;
            min-width: 200px;
          }

          &.th-artist {
            width: 200px;
          }

          &.th-album {
            width: 200px;
          }

          &.th-duration {
            width: 60px;
            justify-content: flex-end;
          }

          &.th-actions {
            width: 80px;
            justify-content: center;
          }
        }
      }

      // 歌曲列表
      .songs-list {
        .song-row {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          gap: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
          border-radius: 8px;
          margin: 2px 0;
          position: relative;

          &:hover {
            background: var(--n-hover-color);

            .row-number {
              opacity: 0;
            }

            .play-icon-wrapper {
              opacity: 1;
            }

            .td-actions .action-buttons {
              opacity: 1;
            }
          }

          &.is-playing {
            background: rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.15);

            .song-title {
              color: var(--n-primary-color);
              font-weight: 600;
            }

            .row-number {
              opacity: 0;
            }

            .play-icon-wrapper {
              opacity: 1;
              color: var(--n-primary-color);
            }

            .td-actions .action-buttons {
              opacity: 1;
            }
          }

          &.is-active {
            .sound-wave {
              animation: soundWave 1s ease-in-out infinite;
            }
          }

          .td {
            flex-shrink: 0;
            display: flex;
            align-items: center;

            // 序号
            &.td-index {
              width: 40px;
              justify-content: center;
              position: relative;

              .row-number {
                font-size: 13px;
                font-weight: 500;
                color: var(--n-text-color-3);
                transition: opacity 0.15s ease;
              }

              .play-icon-wrapper {
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                opacity: 0;
                color: var(--n-text-color);
                transition: opacity 0.15s ease;
                display: flex;
                align-items: center;
                justify-content: center;
              }
            }

            // 标题
            &.td-title {
              flex: 1;
              min-width: 200px;

              .title-content {
                width: 100%;

                .song-title {
                  font-size: 14px;
                  font-weight: 500;
                  color: var(--n-text-color);
                  display: block;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  transition: color 0.15s ease;
                }
              }
            }

            // 艺术家列
            &.td-artist {
              width: 200px;

              .artist-name {
                font-size: 13px;
                color: var(--n-text-color-2);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                display: block;
                width: 100%;
                transition: color 0.15s ease;

                &:hover {
                  color: var(--n-primary-color);
                }
              }
            }

            // 专辑
            &.td-album {
              width: 200px;

              .album-name {
                font-size: 13px;
                color: var(--n-text-color-2);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                display: block;
                width: 100%;
                transition: color 0.15s ease;

                &:hover {
                  color: var(--n-primary-color);
                }
              }
            }

            // 时长
            &.td-duration {
              width: 60px;
              justify-content: flex-end;

              .duration-text {
                font-size: 13px;
                font-weight: 500;
                color: var(--n-text-color-3);
                font-variant-numeric: tabular-nums;
              }
            }

            // 操作
            &.td-actions {
              width: 80px;
              justify-content: center;

              .action-buttons {
                display: flex;
                gap: 4px;
                opacity: 1;
                transition: opacity 0.15s ease;

                .action-btn {
                  width: 28px;
                  height: 28px;
                  border-radius: 6px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.15s ease;

                  &:hover {
                    transform: scale(1.05);
                  }

                  &.delete-btn:hover {
                    color: var(--n-error-color);
                  }
                }
              }
            }
          }
        }
      }
    }

    // 空状态
    .empty-container {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      min-height: 400px;
      padding: 60px 20px;

      .empty-content {
        text-align: center;
        animation: fadeInUp 0.4s ease;

        .empty-icon {
          opacity: 0.5;
          margin-bottom: 24px;
        }

        .empty-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--n-text-color-2);
          margin: 0 0 8px 0;
        }

        .empty-desc {
          font-size: 14px;
          color: var(--n-text-color-3);
          margin: 0 0 24px 0;
        }

        .empty-action-btn {
          padding: 0 24px;
          height: 40px;
          font-size: 14px;
          font-weight: 500;
          border-radius: 8px;
          border: none;
          transition: all 0.2s ease;

          &:hover {
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(var(--n-primary-color-rgb, 22, 119, 255), 0.25);
          }

          &:active {
            transform: translateY(0);
          }
        }
      }
    }
  }

  // ========== 动画 ==========
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes soundWave {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.15);
      opacity: 0.8;
    }
  }

  // ========== 响应式设计 ==========
  @media (max-width: 1200px) {
    .hero-banner {
      padding: 20px 24px;

      .banner-content {
        .banner-left .banner-title {
          font-size: 24px;
        }
      }
    }

    .control-bar {
      padding: 12px 24px;
    }

    .songs-container {
      padding: 0 24px 24px;

      .songs-wrapper {
        .table-header,
        .songs-list .song-row {
          .th-album,
          .td-album {
            display: none;
          }
        }
      }
    }
  }

  @media (max-width: 768px) {
    .hero-banner {
      padding: 16px 16px;

      .banner-content {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;

        .banner-left .banner-title {
          font-size: 20px;
        }

        .banner-actions {
          width: 100%;

          .primary-btn {
            flex: 1;
          }
        }
      }
    }

    .control-bar {
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;

      .search-box,
      .sort-select {
        width: 100%;
        max-width: none;
      }
    }

    .songs-container {
      padding: 0 16px 16px;

      .songs-wrapper {
        .table-header,
        .songs-list .song-row {
          gap: 8px;

          .th-artist,
          .td-artist,
          .th-album,
          .td-album {
            display: none;
          }
        }

        .songs-list .song-row {
          padding: 10px 12px;
        }
      }
    }
  }
}
</style>
