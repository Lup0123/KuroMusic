<template>
  <div class="my-music">
    <!-- 顶部操作栏 -->
    <div class="music-header">
      <h2 class="page-title">我的音乐</h2>
      <div class="actions">
        <el-button type="primary" :icon="Plus" @click="handleImportMusic">
          导入音乐
        </el-button>
        <el-button :icon="RefreshRight" @click="handleRefresh">
          刷新
        </el-button>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon" :size="32"><Headset /></el-icon>
          <div class="stat-info">
            <p class="stat-label">总歌曲</p>
            <p class="stat-value">{{ musicList.length }}</p>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon" :size="32"><User /></el-icon>
          <div class="stat-info">
            <p class="stat-label">艺术家</p>
            <p class="stat-value">{{ artistCount }}</p>
          </div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-content">
          <el-icon class="stat-icon" :size="32"><Collection /></el-icon>
          <div class="stat-info">
            <p class="stat-label">专辑</p>
            <p class="stat-value">{{ albumCount }}</p>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 过滤和排序 -->
    <div class="filters">
      <el-input
        v-model="filterKeyword"
        placeholder="搜索歌曲、艺术家或专辑..."
        :prefix-icon="Search"
        clearable
        style="width: 300px" />
      <el-select v-model="sortBy" placeholder="排序方式" style="width: 150px">
        <el-option label="按名称" value="name" />
        <el-option label="按艺术家" value="artist" />
        <el-option label="按专辑" value="album" />
        <el-option label="按添加时间" value="addTime" />
      </el-select>
    </div>

    <!-- 音乐列表 -->
    <div class="music-list">
      <el-table
        :data="filteredMusicList"
        stripe
        style="width: 100%"
        @row-dblclick="handlePlayMusic">
        <el-table-column type="index" label="#" width="60" />
        <el-table-column label="封面" width="80">
          <template #default="scope">
            <el-image
              :src="scope.row.cover || defaultCover"
              fit="cover"
              class="song-cover" />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="歌曲名称" min-width="200" />
        <el-table-column prop="artist" label="艺术家" min-width="150" />
        <el-table-column prop="album" label="专辑" min-width="150" />
        <el-table-column prop="duration" label="时长" width="100" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope"  >
            <el-button
              type="text"
              :icon="VideoPlay"
              @click="handlePlayMusic(scope.row)">
            </el-button>
            <el-button
              type="text"
              :icon="Plus"
              @click="handleAddToPlaylist(scope.row)"></el-button>
            <el-button
              type="text"
              :icon="Delete"
              @click="handleDelete(scope.row)">
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty
        v-if="musicList.length === 0"
        description="还没有音乐，快去导入吧！"
        :image-size="200">
        <el-button type="primary" @click="handleImportMusic">
          导入音乐
        </el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import {
  importMusicFromLocal,
  saveMusicListToLocal,
  loadMusicListFromLocal
} from './my-music-api'


// 默认封面
const defaultCover =
  'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

// Store
const songStore = useSongStore()
const { playlist } = storeToRefs(songStore)

// 响应式数据
const musicList = ref([])
const filterKeyword = ref('')
const sortBy = ref('name')
const isLoading = ref(false)

// 计算属性
const artistCount = computed(() => {
  return new Set(musicList.value.map((item) => item.artist)).size
})

const albumCount = computed(() => {
  return new Set(musicList.value.map((item) => item.album)).size
})

const filteredMusicList = computed(() => {
  let list = [...musicList.value]

  // 过滤
  if (filterKeyword.value) {
    const keyword = filterKeyword.value.toLowerCase()
    list = list.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.artist.toLowerCase().includes(keyword) ||
        item.album.toLowerCase().includes(keyword)
    )
  }

  // 排序
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

// 方法
const handleImportMusic = async () => {
  try {
    isLoading.value = true
    const importedFiles = await importMusicFromLocal()

    if (importedFiles.length === 0) {
      ElMessage.info('未选择任何文件')
      return
    }

    // 添加到音乐列表
    musicList.value.push(...importedFiles)

    // 保存到本地存储
    saveMusicListToLocal(musicList.value)

    ElMessage.success(`成功导入 ${importedFiles.length} 首歌曲`)
  } catch (error) {
    console.error('导入音乐失败:', error)
    ElMessage.error('导入音乐失败，请重试')
  } finally {
    isLoading.value = false
  }
}

const handleRefresh = () => {
  // 重新从本地存储加载
  musicList.value = loadMusicListFromLocal()
  ElMessage.success('刷新成功')
}

const handlePlayMusic = (row) => {
  songStore.play(row)
}

const handleAddToPlaylist = (row) => {
  songStore.addToPlaylist(row)
  ElMessage.success(`已添加到播放列表: ${row.name}`)
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除 "${row.name}" 吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      const index = musicList.value.findIndex((item) => item.id === row.id)
      if (index > -1) {
        musicList.value.splice(index, 1)
        saveMusicListToLocal(musicList.value)
        ElMessage.success('删除成功')
      }
    })
    .catch(() => {
      ElMessage.info('已取消删除')
    })
}

// 组件挂载时加载数据
onMounted(() => {
  // 检查 Electron API
  if (window.api) {
    console.log('✅ Electron API 可用')
  } else {
    ElMessage.warning('当前环境不支持导入本地音乐功能')
  }

  // 加载本地存储的音乐列表
  musicList.value = loadMusicListFromLocal()
})
</script>

<style scoped lang="scss">
@import './my-music.scss';
</style>
