<template>
  <div class="playlist-detail">
    <!-- 固定顶部栏 (绝对定位，覆盖在滚动容器之上) -->
    <div class="fixed-header" :class="{ visible: isScrolled }">
      <div class="fixed-header-content">
        <div class="left-section">
          <a-button type="text" class="back-btn" @click="goBack">
            <icon-left />
          </a-button>
          <span class="playlist-name">{{ playlist.name }}</span>
        </div>
        <div class="right-section">
          <a-button type="primary" shape="round" @click="playAll">
            <template #icon><icon-play-arrow-fill /></template>
            播放全部
          </a-button>
          <a-button shape="round" @click="downloadAll">
            <template #icon><icon-download /></template>
            下载
          </a-button>
          <a-button shape="circle">
            <template #icon><icon-more /></template>
          </a-button>
        </div>
      </div>
    </div>

    <!-- 滚动容器 (包含大头部和列表) -->
    <div class="scroll-container" @scroll="handleScroll" ref="scrollContainerRef">
      <!-- 完整头部信息区 -->
      <div class="detail-header">
        <a-page-header @back="goBack" :style="{ background: 'transparent' }">
          <!-- 这里的标题留空，因为大标题在下面 -->
        </a-page-header>

        <div class="playlist-info-section">
          <div class="cover-section">
            <a-image :src="playlist.cover" :width="200" :height="200" fit="cover" />
          </div>
          <div class="info-section">
            <h2 class="playlist-title">{{ playlist.name }}</h2>
            <div class="playlist-meta">
              <div class="creator-info">
                <span class="create-time">{{ playlist.createTime }}创建</span>
              </div>
            </div>
            <div class="playlist-description">{{ playlist.description || '暂无描述' }}</div>
            <div class="action-buttons">
              <a-button type="primary" size="large" class="play-all-btn" @click="playAll">
                <template #icon><icon-play-arrow-fill /></template>
                播放全部
              </a-button>
              <a-button size="large" class="action-btn" @click="downloadAll">
                <template #icon><icon-download /></template>
                下载
              </a-button>
              <a-button size="large" class="action-btn" @click="testAPI">
                <template #icon><icon-more /></template>
              </a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 歌曲列表区域 -->
      <div class="song-list-section">
        <!-- 列表表头 (Sticky) -->
        <div class="list-header">
          <div class="header-row">
            <div class="col-index">#</div>
            <div class="col-title">标题</div>
            <div class="col-album">专辑</div>
            <div class="col-like">喜欢</div>
            <div class="col-duration">时长</div>
          </div>
        </div>

        <div class="list-body">
          <div
            v-for="(song, index) in songs"
            :key="song.id + index"
            class="song-item"
            :class="{ active: currentSong?.id === song.id }"
            @dblclick="playSong(song, index)"
          >
            <div class="col-index">
              <span class="index-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="play-icon-wrapper" @click.stop="playSong(song, index)">
                <icon-play-arrow-fill />
              </div>
              <icon-play-arrow-fill v-if="currentSong?.id === song.id" class="playing-indicator" />
            </div>

            <div class="col-title">
              <div class="song-cover">
                <a-image :src="song.cover" :width="40" :height="40" fit="cover" />
              </div>
              <div class="song-info">
                <div class="song-name">
                  <span v-if="song.vip" class="vip-badge">VIP</span>
                  {{ song.name }}
                </div>
                <div class="song-artist">{{ song.artist }}</div>
              </div>
            </div>

            <!-- 专辑列 (默认显示) -->
            <div class="col-album">
              <span class="album-name">{{ song.album }}</span>
            </div>

            <!-- 操作列 (悬停显示，占据专辑列的位置) -->
            <div class="col-operations">
              <a-tooltip content="添加到歌单"><icon-folder-add /></a-tooltip>
              <a-tooltip content="下载"><icon-download /></a-tooltip>
              <a-tooltip content="评论"><icon-message /></a-tooltip>
              <a-tooltip content="更多"><icon-more /></a-tooltip>
            </div>

            <div class="col-like">
              <div class="like-btn" :class="{ liked: song.liked }" @click.stop="toggleLike(song)">
                <icon-heart-fill v-if="song.liked" />
                <icon-heart v-else />
              </div>
            </div>

            <div class="col-duration">{{ song.duration }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import {
  IconPlayArrowFill,
  IconDownload,
  IconMore,
  IconHeart,
  IconHeartFill,
  IconLeft,
  IconFolderAdd,
  IconMessage
} from '@arco-design/web-vue/es/icon'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useIndexStore } from '@/stores/indexStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { formatDate, formatTime } from '@/utils/utils'

const router = useRouter()
const route = useRoute()
const isScrolled = ref(false)
const scrollContainerRef = ref(null)
const indexStore = useIndexStore()
const playlistStore = usePlaylistStore()
const songStore = useSongStore()

const { setCurIndex } = indexStore
const { currentPlaylistInfo } = storeToRefs(playlistStore)
const { currentSong } = storeToRefs(songStore)

// 歌单信息
const playlist = ref({
  id: currentPlaylistInfo.value.id,
  name: currentPlaylistInfo.value.name,
  cover: currentPlaylistInfo.value.cover,
  description: currentPlaylistInfo.value.description,
  createTime: formatDate(currentPlaylistInfo.value.createTime)
})

// 歌曲列表数据
const songs = ref([])

// 处理滚动 - 监听 scrollContainer
const handleScroll = (e) => {
  const scrollTop = e.target.scrollTop
  isScrolled.value = scrollTop > 220
}

const goBack = () => {
  setCurIndex('mainpage')
}

const playAll = () => {
  if (songs.value.length > 0) {
    // 使用 playlistStore 的方法播放整个歌单
    playlistStore.setCurrentPlaylistSongs(songs.value)
    const success = playlistStore.playCurrentPlaylist()
    if (success) {
      Message.success('开始播放全部歌曲')
    }
  }
}

const downloadAll = () => Message.info('开始下载全部歌曲')

const playSong = (song, index) => {
  // 使用 playlistStore 的方法播放指定歌曲
  playlistStore.setCurrentPlaylistSongs(songs.value)
  playlistStore.playCurrentPlaylistSong(index)
}

const toggleLike = (song) => {
  song.liked = !song.liked
  Message.success(song.liked ? '已添加到我喜欢' : '已取消喜欢')
}

const addSongs = () => Message.info('打开添加歌曲面板')

const testAPI = async () => {
  try {
    const responseSongs = await window.api.getPlaylistsAllSongs(playlist.value.id)
    const responsePlaylist = await window.api.getPlaylistsDetails(playlist.value.id)
    console.log('Test API Response:', responseSongs)
    console.log('Test API Playlist Response:', responsePlaylist)
  } catch (error) {
    console.error('Error calling testAPI:', error)
  }
}

onMounted(async () => {
  if (!playlist.value.id) return

  try {
    const responseSongs = await window.api.getPlaylistsAllSongs(playlist.value.id)
    if (responseSongs && responseSongs.body.songs) {
      // 直接通过 store 实例调用 normalizeSong 方法
      songs.value = responseSongs.body.songs.map((song) => playlistStore.normalizeSong(song))
      // 同步到 playlistStore
      playlistStore.setCurrentPlaylistSongs(songs.value)
      console.log('Loaded playlist songs:', songs.value)
    }
  } catch (error) {
    console.error('Failed to load playlist songs:', error)
  }
})
</script>

<style lang="scss" scoped>
@import './playlistDetail.scss';
</style>
