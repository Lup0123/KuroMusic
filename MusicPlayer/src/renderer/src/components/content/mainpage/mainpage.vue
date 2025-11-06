<template>
  <div class="mainpage">
    <!-- 轮播图区域 -->
    <div class="banner-section">
      <el-carousel height="300px" arrow="always">
        <el-carousel-item v-for="item in banners" :key="item.id">
          <div
            class="banner-item"
            :style="{ backgroundImage: `url(${item.image})` }">
            <div class="banner-content">
              <h2>{{ item.title }}</h2>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </el-carousel-item>
      </el-carousel>
    </div>

    <!-- 推荐歌单 -->
    <div class="section recommend-playlists">
      <div class="section-header">
        <h3>推荐歌单</h3>
        <el-button type="text"
          >更多 <el-icon><ArrowRight /></el-icon
        ></el-button>
      </div>
      <div class="playlist-grid">
        <div
          class="playlist-card"
          v-for="playlist in recommendPlaylists"
          :key="playlist.id">
          <div class="playlist-cover">
            <el-image :src="playlist.cover" fit="cover">
              <template #placeholder>
                <div class="image-placeholder">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <div class="play-overlay">
              <el-button circle size="large" type="primary">
                <el-icon size="24"><CaretRight /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="playlist-info">
            <h4>{{ playlist.name }}</h4>
            <p>{{ playlist.playCount }} 次播放</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 新歌推荐 -->
    <div class="section new-songs">
      <div class="section-header">
        <h3>新歌推荐</h3>
        <el-button type="text"
          >更多 <el-icon><ArrowRight /></el-icon
        ></el-button>
      </div>
      <div class="song-list">
        <div class="song-item" v-for="song in newSongs" :key="song.id">
          <div class="song-index">{{ song.index }}</div>
          <el-image :src="song.cover" class="song-cover" fit="cover">
            <template #placeholder>
              <div class="image-placeholder">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-image>
          <div class="song-info">
            <div class="song-name">{{ song.name }}</div>
            <div class="song-artist">{{ song.artist }}</div>
          </div>
          <div class="song-album">{{ song.album }}</div>
          <div class="song-duration">{{ song.duration }}</div>
          <div class="song-actions">
            <el-button type="text" circle>
              <el-icon><CaretRight /></el-icon>
            </el-button>
            <el-button type="text" circle>
              <el-icon><Plus /></el-icon>
            </el-button>
            <el-button type="text" circle>
              <el-icon><Star /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 热门歌手 -->
    <div class="section hot-artists">
      <div class="section-header">
        <h3>热门歌手</h3>
        <el-button type="text"
          >更多 <el-icon><ArrowRight /></el-icon
        ></el-button>
      </div>
      <div class="artist-grid">
        <div class="artist-card" v-for="artist in hotArtists" :key="artist.id">
          <el-avatar :size="120" :src="artist.avatar">
            <el-icon><User /></el-icon>
          </el-avatar>
          <h4>{{ artist.name }}</h4>
          <p>{{ artist.followers }} 粉丝</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  ArrowRight,
  CaretRight,
  Plus,
  Star,
  Picture,
  User
} from '@element-plus/icons-vue'

// 轮播图数据
const banners = ref([
  {
    id: 1,
    title: '发现好音乐',
    description: '海量曲库,随心畅听',
    image: 'https://via.placeholder.com/1200x300/4A90E2/ffffff?text=Banner+1'
  },
  {
    id: 2,
    title: '每日推荐',
    description: '根据你的喜好,每日精选',
    image: 'https://via.placeholder.com/1200x300/E74C3C/ffffff?text=Banner+2'
  },
  {
    id: 3,
    title: '热门榜单',
    description: '最新最热,一网打尽',
    image: 'https://via.placeholder.com/1200x300/F39C12/ffffff?text=Banner+3'
  }
])

// 推荐歌单
const recommendPlaylists = ref([
  {
    id: 1,
    name: '欧美流行精选',
    cover: 'https://via.placeholder.com/200',
    playCount: '128万'
  },
  {
    id: 2,
    name: '华语经典老歌',
    cover: 'https://via.placeholder.com/200',
    playCount: '96万'
  },
  {
    id: 3,
    name: '摇滚必听榜',
    cover: 'https://via.placeholder.com/200',
    playCount: '85万'
  },
  {
    id: 4,
    name: '轻音乐合集',
    cover: 'https://via.placeholder.com/200',
    playCount: '72万'
  },
  {
    id: 5,
    name: '电音狂潮',
    cover: 'https://via.placeholder.com/200',
    playCount: '68万'
  }
])

// 新歌推荐
const newSongs = ref([
  {
    id: 1,
    index: 1,
    name: '新歌名称1',
    artist: '歌手1',
    album: '专辑1',
    duration: '03:45',
    cover: 'https://via.placeholder.com/60'
  },
  {
    id: 2,
    index: 2,
    name: '新歌名称2',
    artist: '歌手2',
    album: '专辑2',
    duration: '04:12',
    cover: 'https://via.placeholder.com/60'
  },
  {
    id: 3,
    index: 3,
    name: '新歌名称3',
    artist: '歌手3',
    album: '专辑3',
    duration: '03:28',
    cover: 'https://via.placeholder.com/60'
  },
  {
    id: 4,
    index: 4,
    name: '新歌名称4',
    artist: '歌手4',
    album: '专辑4',
    duration: '04:35',
    cover: 'https://via.placeholder.com/60'
  },
  {
    id: 5,
    index: 5,
    name: '新歌名称5',
    artist: '歌手5',
    album: '专辑5',
    duration: '03:52',
    cover: 'https://via.placeholder.com/60'
  }
])

// 热门歌手
const hotArtists = ref([
  {
    id: 1,
    name: '歌手A',
    avatar: 'https://via.placeholder.com/120',
    followers: '256万'
  },
  {
    id: 2,
    name: '歌手B',
    avatar: 'https://via.placeholder.com/120',
    followers: '189万'
  },
  {
    id: 3,
    name: '歌手C',
    avatar: 'https://via.placeholder.com/120',
    followers: '145万'
  },
  {
    id: 4,
    name: '歌手D',
    avatar: 'https://via.placeholder.com/120',
    followers: '132万'
  },
  {
    id: 5,
    name: '歌手E',
    avatar: 'https://via.placeholder.com/120',
    followers: '98万'
  }
])
</script>

<style scoped lang="scss">
@import './mainpage.scss';
</style>
