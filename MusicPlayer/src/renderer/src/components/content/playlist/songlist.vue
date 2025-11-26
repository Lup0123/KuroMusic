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
          <a-button type="text" @click="clearPlaylist" title="清空播放列表">
            <template #icon>
              <icon-delete />
            </template>
          </a-button>
          <a-button type="text" @click="closePlaylist" title="关闭">
            <template #icon>
              <icon-close />
            </template>
          </a-button>
        </div>
      </div>

      <a-scrollbar class="playlist-content">
        <transition-group name="song-list" tag="div">
          <div
            class="playlist-item"
            v-for="(song, index) in playlist"
            :key="song.id || index"
            @click="playSong(index)"
            :class="{ active: currentSongIndex === index }"
          >
            <div class="song-index">
              <span v-if="currentSongIndex !== index">{{ index + 1 }}</span>
              <icon-play-arrow v-else class="playing-icon" />
            </div>
            <div class="song-info">
              <div class="song-title">{{ song.name }}</div>
              <div class="song-artist">{{ song.artist }}</div>
            </div>
            <div class="song-duration">{{ song.duration }}</div>
            <div class="song-actions">
              <a-button
                type="text"
                shape="circle"
                size="small"
                @click.stop="removeSong(index)"
                title="移除"
              >
                <template #icon>
                  <icon-close />
                </template>
              </a-button>
            </div>
          </div>
        </transition-group>

        <!-- 空状态 -->
        <div class="empty-state" v-if="playlist.length === 0">
          <icon-music :size="60" />
          <p>播放列表为空</p>
        </div>
      </a-scrollbar>
    </div>
  </transition>
</template>

<script setup>
import { Modal } from '@arco-design/web-vue'
import { useSongStore } from '@/stores/songStore'
import { storeToRefs } from 'pinia'
import { IconDelete, IconClose, IconPlayArrow, IconMusic } from '@arco-design/web-vue/es/icon'

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
  Modal.confirm({
    title: '提示',
    content: '确定要清空播放列表吗?',
    okText: '确定',
    cancelText: '取消',
    onOk: () => {
      playlist.value = []
      songStore.currentSongIndex = -1
      songStore.isPlaying = false
    }
  })
}
</script>

<style lang="scss" scoped>
@import './songlist.scss';
</style>
