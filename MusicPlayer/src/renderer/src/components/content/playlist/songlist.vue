<template>
  <!-- 遮罩层 -->
  <transition name="fade">
    <div v-show="props.visible" class="playlist-overlay" @click="closePlaylist"></div>
  </transition>

  <!-- 播放列表弹窗 -->
  <transition name="slide">
    <div v-show="props.visible" class="playlist-drawer" @click.stop>
      <div class="playlist-header">
        <h3>播放列表</h3>
        <div class="playlist-stats">
          <span>共 {{ playlist.length }} 首</span>
        </div>
        <div class="playlist-actions">
          <a-button type="text" title="清空播放列表" @click="clearPlaylist">
            <template #icon>
              <icon-delete />
            </template>
          </a-button>
          <a-button type="text" title="关闭" @click="closePlaylist">
            <template #icon>
              <icon-close />
            </template>
          </a-button>
        </div>
      </div>

      <div class="playlist-content">
        <transition-group name="song-list" tag="div">
          <div
            v-for="(song, index) in playlist"
            :key="song.id || index"
            class="playlist-item"
            :class="{ active: currentSongIndex === index }"
            @click="playSong(index)"
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
                title="移除"
                @click.stop="removeSong(index)"
              >
                <template #icon>
                  <icon-close />
                </template>
              </a-button>
            </div>
          </div>
        </transition-group>

        <!-- 空状态 -->
        <div v-if="playlist.length === 0" class="empty-state">
          <icon-music :size="60" />
          <p>播放列表为空</p>
        </div>
      </div>
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
