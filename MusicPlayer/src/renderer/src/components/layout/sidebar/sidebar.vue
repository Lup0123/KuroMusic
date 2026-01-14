<template>
  <a-layout-sider width="240px" class="sidebar">
    <a-menu
      :selected-keys="selectedPlaylistKey ? [selectedPlaylistKey] : [cur_index]"
      class="sidebar-menu"
      @menu-item-click="handleMenuClick"
      :level-indent="8"
    >
      <a-menu-item key="mainpage">
        <template #icon>
          <icon-home />
        </template>
        发现
      </a-menu-item>
      <a-menu-item key="my-music">
        <template #icon>
          <icon-music />
        </template>
        我的音乐
      </a-menu-item>

      <a-divider />

      <a-sub-menu key="my-playlists">
        <template #icon>
          <icon-folder />
        </template>
        <template #title>
          <div class="playlist-title">
            <span>本地歌单</span>
            <a-button type="text" size="large" @click.stop="showCreateModal">
              <template #icon>
                <icon-plus :size="20" style="margin-left: 14px" />
              </template>
            </a-button>
          </div>
        </template>

        <a-sub-menu key="created-playlists">
          <template #title>
            我创建的歌单
            <a-badge :count="createdPlaylists.length" :max-count="99" />
          </template>
          <a-menu-item
            v-for="playlist in createdPlaylists"
            :key="`created-${playlist.id}`"
            @click="handlePlaylistClick(playlist)"
            class="playlist-item-with-delete"
          >
            <template #icon>
              <icon-list />
            </template>
            <span class="playlist-item-content">
              <span class="playlist-name">{{ playlist.name }}</span>
              <icon-delete
                class="delete-icon"
                :size="16"
                @click.stop="handleDeletePlaylist(playlist)"
              />
            </span>
          </a-menu-item>
          <a-menu-item v-if="createdPlaylists.length === 0" disabled>
            <span style="color: var(--color-text-4)">暂无歌单</span>
          </a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="favorite-playlists">
          <template #title>
            收藏的歌单
            <a-badge :count="favoritePlaylists.length" :max-count="99" />
          </template>
          <a-menu-item
            v-for="playlist in favoritePlaylists"
            :key="`favorite-${playlist.id}`"
            @click="handlePlaylistClick(playlist)"
            class="playlist-item-with-delete"
          >
            <template #icon>
              <icon-star-fill />
            </template>
            <span class="playlist-item-content">
              <span class="playlist-name">{{ playlist.name }}</span>
              <icon-delete
                class="delete-icon"
                :size="16"
                @click.stop="handleDeleteFavoritePlaylist(playlist)"
              />
            </span>
          </a-menu-item>
          <a-menu-item v-if="favoritePlaylists.length === 0" disabled>
            <span style="color: var(--color-text-4)">暂无收藏</span>
          </a-menu-item>
        </a-sub-menu>
      </a-sub-menu>

      <a-divider v-if="userPlaylists.length > 0" />

      <a-sub-menu key="user-playlists" v-if="userPlaylists.length > 0" class="user-playlists-menu">
        <template #icon>
          <icon-user />
        </template>
        <template #title>
          在线歌单
          <a-badge :count="userPlaylists.length" :max-count="99" />
        </template>
        <div class="user-playlists-container">
          <a-menu-item
            v-for="playlist in userPlaylists"
            :key="`user-${playlist.id}`"
            @click="handlePlaylistClick(playlist)"
          >
            <template #icon>
              <icon-list />
            </template>
            <span class="playlist-name">{{ playlist.name }}</span>
          </a-menu-item>
        </div>
      </a-sub-menu>
    </a-menu>

    <!-- 创建歌单弹窗 -->
    <a-modal
      v-model:visible="createModalVisible"
      title="创建歌单"
      :on-before-ok="handleCreatePlaylist"
      @cancel="handleCancelCreate"
    >
      <a-form :model="newPlaylist">
        <a-form-item label="歌单名称" required>
          <a-input
            ref="nameInputRef"
            v-model="newPlaylist.name"
            placeholder="请输入歌单名称"
            :max-length="40"
            allow-clear
            @press-enter="handleEnter"
          />
        </a-form-item>
        <a-form-item label="歌单描述">
          <a-textarea
            v-model="newPlaylist.description"
            placeholder="请输入歌单描述"
            :max-length="200"
            :auto-size="{ minRows: 3, maxRows: 5 }"
            allow-clear
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout-sider>
</template>

<script setup>
import { ref, onMounted, nextTick, toRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useIndexStore } from '@/stores/indexStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useUserStore } from '@/stores/userStore'
import { storeToRefs } from 'pinia'
import { Message, Modal } from '@arco-design/web-vue'
import {
  IconHome,
  IconMusic,
  IconFolder,
  IconPlus,
  IconList,
  IconStarFill,
  IconDelete,
  IconUser
} from '@arco-design/web-vue/es/icon'

const router = useRouter()
const indexStore = useIndexStore()
const playlistStore = usePlaylistStore()
const userStore = useUserStore()

const { setCurIndex } = indexStore
const { cur_index, selectedPlaylistKey } = storeToRefs(indexStore)
const { createdPlaylists, favoritePlaylists, userPlaylists } = storeToRefs(playlistStore)
const { userInfo, isLoggedIn } = storeToRefs(userStore)

// 创建歌单相关
const nameInputRef = ref(null)
const createModalVisible = ref(false)
const newPlaylist = ref({
  name: '',
  description: ''
})

const handleMenuClick = (key) => {
  setCurIndex(key)
}

const showCreateModal = () => {
  createModalVisible.value = true
  newPlaylist.value = {
    name: '',
    description: ''
  }
  nextTick(() => {
    nameInputRef.value?.focus()
  })
}

const handleCreatePlaylist = async () => {
  if (!newPlaylist.value.name.trim()) {
    Message.warning('请输入歌单名称')
    return false
  }

  try {
    const result = await playlistStore.createLocalPlaylist(toRaw(newPlaylist.value))
    if (result) {
      Message.success('歌单创建成功')
      newPlaylist.value = { name: '', description: '' }
      return true
    } else {
      Message.error('歌单创建失败')
      return false
    }
  } catch (error) {
    console.error('创建歌单失败:', error)
    Message.error('歌单创建失败')
    return false
  }
}

const handleEnter = async () => {
  const success = await handleCreatePlaylist()
  if (success) {
    createModalVisible.value = false
  }
}

const handleCancelCreate = () => {
  createModalVisible.value = false
  newPlaylist.value = { name: '', description: '' }
}

const handlePlaylistClick = (playlist) => {
  const playlistKey = playlist.isLocal ? `created-${playlist.id}` : `favorite-${playlist.id}`

  indexStore.setSelectedPlaylistKey(playlistKey)
  playlistStore.setCurrentPlaylist(playlist)

  // 如果当前已经在歌单详情页，强制刷新
  if (cur_index.value === 'PlaylistDetail') {
    indexStore.forceRefresh()
  } else {
    setCurIndex('PlaylistDetail')
  }
}

const handleDeletePlaylist = async (playlist) => {
  Modal.warning({
    title: '确认删除',
    content: `确定要删除歌单 "${playlist.name}" 吗？此操作无法撤销。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      try {
        const success = await playlistStore.deleteLocalPlaylist(playlist.id)
        if (success) {
          Message.success('歌单已删除')
          // 如果当前正在查看被删除的歌单，返回主页
          if (playlistStore.currentPlaylistInfo.id === playlist.id) {
            setCurIndex('mainpage')
          }
        } else {
          Message.error('删除失败')
        }
      } catch (error) {
        console.error('删除歌单失败:', error)
        Message.error('删除失败')
      }
    }
  })
}

const handleDeleteFavoritePlaylist = async (playlist) => {
  Modal.warning({
    title: '确认取消收藏',
    content: `确定要取消收藏歌单 "${playlist.name}" 吗？`,
    okText: '取消收藏',
    cancelText: '保留',
    onOk: async () => {
      try {
        const success = await playlistStore.removeFromFavoritePlaylist(playlist.id)
        if (success) {
          Message.success('已取消收藏')
          // 如果当前正在查看被取消收藏的歌单，返回主页
          if (playlistStore.currentPlaylistInfo.id === playlist.id) {
            setCurIndex('mainpage')
          }
        } else {
          Message.error('取消收藏失败')
        }
      } catch (error) {
        console.error('取消收藏失败:', error)
        Message.error('操作失败')
      }
    }
  })
}

// 加载歌单数据
onMounted(async () => {
  await playlistStore.loadLocalPlaylists()

  // 如果用户已登录，加载用户歌单
  if (isLoggedIn.value && userInfo.value?.userId) {
    await playlistStore.loadUserPlaylists(userInfo.value.userId, 1000)
  }
})

// 监听登录状态变化
watch(isLoggedIn, async (newValue) => {
  if (newValue && userInfo.value?.userId) {
    // 用户登录后加载歌单
    await playlistStore.loadUserPlaylists(userInfo.value.userId, 1000)
  } else {
    // 用户登出后清空用户歌单
    playlistStore.userPlaylists = []
  }
})
</script>

<style scoped>
@import './sidebar.scss';
</style>
