<template>
  <!-- 遮罩层 -->
  <transition name="fade">
    <div class="playlist-overlay" v-show="visible" @click="closePlaylist"></div>
  </transition>

  <!-- 播放列表弹窗 -->
  <transition name="slide">
    <div class="playlist-drawer" v-show="visible" @click.stop>
      <div class="playlist-header">
        <h3>播放列表</h3>
        <div class="playlist-stats">
          <span>共 {{ playlist.length }} 首</span>
        </div>
        <div class="playlist-actions">
          <el-button type="text" @click="clearPlaylist" title="清空播放列表">
            <el-icon><Delete /></el-icon>
          </el-button>
          <el-button type="text" @click="closePlaylist" title="关闭">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>

      <el-scrollbar class="playlist-content">
        <transition-group name="song-list" tag="div">
          <div
            class="playlist-item"
            v-for="(song, index) in playlist"
            :key="song.id || index"
            @click="playSong(index)"
            :class="{ active: currentSongIndex === index }">
            <div class="song-index">
              <span v-if="currentSongIndex !== index">{{ index + 1 }}</span>
              <el-icon v-else class="playing-icon">
                <CaretRight />
              </el-icon>
            </div>
            <div class="song-info">
              <div class="song-title">{{ song.name }}</div>
              <div class="song-artist">{{ song.artist }}</div>
            </div>
            <div class="song-duration">{{ song.duration }}</div>
            <div class="song-actions">
              <el-button
                type="text"
                circle
                size="small"
                @click.stop="removeSong(index)"
                title="移除">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </div>
        </transition-group>

        <!-- 空状态 -->
        <div class="empty-state" v-if="playlist.length === 0">
          <el-icon size="60"><Notebook /></el-icon>
          <p>播放列表为空</p>
        </div>
      </el-scrollbar>
    </div>
  </transition>
</template>

<script setup>
import { ElMessageBox } from 'element-plus'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'

// 引入 store
const songStore = useSongStore()
const { playlist, currentSongIndex } = storeToRefs(songStore)

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible'])

const closePlaylist = () => {
  emit('update:visible', false)
}

const playSong = (index) => {
  songStore.currentSongIndex = index
  songStore.isPlaying = true
}

const removeSong = (index) => {
  songStore.removeFromPlaylist(index)
}

const clearPlaylist = async () => {
  try {
    await ElMessageBox.confirm('确定要清空播放列表吗?', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    playlist.value = []
    songStore.currentSongIndex = -1
    songStore.isPlaying = false
  } catch {
    // 用户取消
  }
}
</script>

<style lang="scss" scoped>
@import './songlist.scss';
</style>
