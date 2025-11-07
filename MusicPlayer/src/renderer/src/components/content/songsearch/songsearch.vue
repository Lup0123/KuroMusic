<template>
  <div class="song-search-container">
    <!-- 搜索头部 -->
    <div class="search-header">
      <h2>搜索音乐</h2>
      <div class="search-input-wrapper">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索歌曲、歌手、专辑..."
          size="large"
          clearable
          @keyup.enter="handleSearch"
          @clear="handleClear"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #append>
            <el-button :icon="Search" @click="handleSearch">搜索</el-button>
          </template>
        </el-input>
      </div>
    </div>

    <!-- 搜索标签 -->
    <div class="search-tabs" v-if="hasSearched">
      <el-radio-group v-model="activeTab" @change="handleTabChange">
        <el-radio-button value="songs">
          单曲
          <span class="count" v-if="searchResults.songs">({{ searchResults.songs.length }})</span>
        </el-radio-button>
        <el-radio-button value="artists">
          歌手
          <span class="count" v-if="searchResults.artists"
            >({{ searchResults.artists.length }})</span
          >
        </el-radio-button>
        <el-radio-button value="albums">
          专辑
          <span class="count" v-if="searchResults.albums">({{ searchResults.albums.length }})</span>
        </el-radio-button>
        <el-radio-button value="playlists">
          歌单
          <span class="count" v-if="searchResults.playlists"
            >({{ searchResults.playlists.length }})</span
          >
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- 搜索结果 -->
    <div class="search-results" v-if="hasSearched">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-container">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p>搜索中...</p>
      </div>

      <!-- 无结果 -->
      <el-empty
        v-else-if="!loading && currentResults.length === 0"
        description="暂无搜索结果"
        :image-size="200"
      />

      <!-- 单曲列表 -->
      <div v-else-if="activeTab === 'songs'" class="songs-list">
        <el-table :data="currentResults" style="width: 100%" @row-dblclick="playSong">
          <el-table-column type="index" width="60" label="#" />

          <!-- 歌曲名称列 -->
          <el-table-column prop="name" label="歌曲" min-width="200">
            <template #default="{ row }">
              <div class="song-info">
                <span class="song-name">{{ row.name }}</span>
                <span class="song-alias" v-if="row.alias">{{ row.alias }}</span>
              </div>
            </template>
          </el-table-column>

          <!-- 歌手列 -->
          <el-table-column prop="artist" label="歌手" width="180" />

          <!-- 专辑列 - 添加封面 -->
          <el-table-column prop="album" label="专辑" width="220">
            <template #default="{ row }">
              <div class="album-cell">
                <el-image
                  v-if="row.albumCover"
                  :src="row.albumCover"
                  fit="cover"
                  class="album-thumb"
                />
                <span class="album-name">{{ row.album }}</span>
              </div>
            </template>
          </el-table-column>

          <!-- 时长列 -->
          <el-table-column prop="duration" label="时长" width="100" align="center" />

          <!-- 操作列 -->
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button type="text" :icon="VideoPlay" @click="playSong(row)">播放</el-button>
              <el-button type="text" :icon="Plus" @click="addToPlaylist(row)">添加</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 歌手列表 -->
      <div v-else-if="activeTab === 'artists'" class="artists-grid">
        <div
          v-for="artist in currentResults"
          :key="artist.id"
          class="artist-card"
          @click="goToArtist(artist)"
        >
          <el-image :src="artist.avatar" fit="cover" class="artist-avatar">
            <template #error>
              <div class="image-error">
                <el-icon><User /></el-icon>
              </div>
            </template>
          </el-image>
          <div class="artist-name">{{ artist.name }}</div>
          <div class="artist-desc">歌手</div>
        </div>
      </div>

      <!-- 专辑列表 -->
      <div v-else-if="activeTab === 'albums'" class="albums-grid">
        <div
          v-for="album in currentResults"
          :key="album.id"
          class="album-card"
          @click="goToAlbum(album)"
        >
          <el-image :src="album.cover" fit="cover" class="album-cover">
            <!-- <template #error>
              <div class="image-error">
                <el-icon><Picture /></el-icon>
              </div>
            </template> -->
          </el-image>
          <div class="album-info">
            <div class="album-name">{{ album.name }}</div>
            <div class="album-artist">{{ album.artist }}</div>
          </div>
        </div>
      </div>

      <!-- 歌单列表 -->
      <div v-else-if="activeTab === 'playlists'" class="playlists-grid">
        <div
          v-for="playlist in currentResults"
          :key="playlist.id"
          class="playlist-card"
          @click="goToPlaylist(playlist)"
        >
          <el-image :src="playlist.cover" fit="cover" class="playlist-cover">
            <template #error>
              <div class="image-error">
                <el-icon><Folder /></el-icon>
              </div>
            </template>
          </el-image>
          <div class="playlist-info">
            <div class="playlist-name">{{ playlist.name }}</div>
            <div class="playlist-count">{{ playlist.trackCount }} 首歌曲</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 未搜索提示 -->
    <div v-else class="empty-state">
      <el-icon :size="100" color="#909399"><Search /></el-icon>
      <h3>搜索音乐</h3>
      <p>输入歌曲、歌手或专辑名称开始搜索</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Loading, VideoPlay, Plus, User, Picture, Folder } from '@element-plus/icons-vue'
import { useSearchStore } from '@/stores/searchStore'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'

// 使用搜索 store
const searchStore = useSearchStore()
const { searchKeyword, searchResults, activeTab, hasSearched, loading } = storeToRefs(searchStore)

const {
  setSearchKeyword,
  setSearchResults,
  setActiveTab,
  setHasSearched,
  setLoading,
  clearSearch
} = searchStore

// 使用歌曲 store
const songStore = useSongStore()
const { playSong: playSongInStore, addToPlaylist: addToPlaylistInStore } = songStore

// 本地搜索关键词（用于输入框双向绑定）
const localSearchKeyword = ref('')

// 计算当前显示的结果
const currentResults = computed(() => {
  return searchResults.value[activeTab.value] || []
})

// 组件挂载时检查是否有搜索关键词
onMounted(() => {
  if (searchKeyword.value) {
    localSearchKeyword.value = searchKeyword.value
    handleSearch()
  }
})

// 搜索处理
const handleSearch = async () => {
  const keyword = localSearchKeyword.value || searchKeyword.value

  if (!keyword.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }

  setLoading(true)
  setHasSearched(true)
  setSearchKeyword(keyword.trim())

  try {
    const results = await window.api.search(keyword)

    if (results && results.body && results.body.result) {
      setSearchResults(results.body.result)
      ElMessage.success(`找到 ${searchResults.value.trackCount} 首歌曲`)
      console.log('搜索结果:', searchResults.value)
    } else {
      ElMessage.warning('未找到相关结果')
    }
  } catch (error) {
    ElMessage.error('搜索失败,请重试')
    console.error('搜索错误:', error)
  } finally {
    setLoading(false)
  }
}

// 清空搜索
const handleClear = () => {
  localSearchKeyword.value = ''
  clearSearch()
}

// 切换标签
const handleTabChange = (tab) => {
  setActiveTab(tab)
}

// 播放歌曲 - 核心逻辑
const playSong = async (song) => {
  try {
    ElMessage({
      message: `正在加载: ${song.name}`,
      duration: 2000
    })

    // 获取歌曲播放链接
    const response = await window.api.getSongUrl(song.id, 'standard')
    ElMessage.closeAll()
    console.log('获取播放链接结果:', response)
    const result = response.body
    console.log('播放链接结果体:', result)
    if (result.code == 200) {
      // 构建完整的歌曲对象
      const fullSong = {
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        cover: song.albumCover || 'https://via.placeholder.com/50',
        duration: song.duration,
        durationMs: song.durationMs,
        path: result.data[0].url, // 播放链接
        type: result.data[0].type,
        size: result.data[0].size,
        br: result.data[0].br
      }
      // 调用播放器播放
      playSongInStore(fullSong)

      ElMessage.success({
        message: `开始播放: ${song.name}`,
        duration: 2000
      })

      console.log('播放歌曲信息:', fullSong)
    } else {
      ElMessage.error(result.error || '无法获取播放链接')
    }
  } catch (error) {
    ElMessage.closeAll()
    ElMessage.error('获取播放链接失败')
    console.error('播放错误:', error)
  }
}

// 添加到播放列表
const addToPlaylist = async (song) => {
  try {
    ElMessage.loading({
      message: '正在添加...',
      duration: 0
    })

    // 获取歌曲播放链接
    const result = await window.api.getSongUrl(song.id, 'standard')
    ElMessage.closeAll()

    if (result.success && result.url) {
      // 构建完整的歌曲对象
      const fullSong = {
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        cover: song.albumCover || 'https://via.placeholder.com/50',
        duration: song.duration,
        durationMs: song.durationMs,
        path: result.url,
        type: result.type,
        size: result.size,
        br: result.br
      }

      // 添加到播放列表
      addToPlaylistInStore(fullSong)

      ElMessage.success({
        message: `已添加: ${song.name}`,
        duration: 2000
      })
    } else {
      ElMessage.error(result.error || '无法获取歌曲信息')
    }
  } catch (error) {
    ElMessage.closeAll()
    ElMessage.error('添加失败')
    console.error('添加错误:', error)
  }
}

// 跳转到歌手详情
const goToArtist = (artist) => {
  ElMessage.info(`查看歌手: ${artist.name}`)
  // TODO: 跳转到歌手详情页
}

// 跳转到专辑详情
const goToAlbum = (album) => {
  ElMessage.info(`查看专辑: ${album.name}`)
  // TODO: 跳转到专辑详情页
}

// 跳转到歌单详情
const goToPlaylist = (playlist) => {
  ElMessage.info(`查看歌单: ${playlist.name}`)
  // TODO: 跳转到歌单详情页
}
</script>

<style scoped lang="scss">
@import './songsearch.scss';

.album-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .album-thumb {
    width: 40px;
    height: 40px;
    border-radius: 4px;
    flex-shrink: 0;
    object-fit: cover;
  }

  .album-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
