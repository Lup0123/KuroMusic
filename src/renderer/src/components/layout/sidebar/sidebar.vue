<template>
  <n-layout-sider
    width="240px"
    class="sidebar"
    bordered
    content-style="padding: 0;"
    :style="siderStyle"
    :native-scrollbar="false"
  >
    <div class="sidebar-search">
      <n-input
        v-model:value="searchText"
        placeholder="搜索音乐、歌手、专辑…"
        clearable
        round
        @keyup.enter="doSearch"
      >
        <template #prefix>
          <n-icon><SearchOutline /></n-icon>
        </template>
      </n-input>
    </div>

    <n-menu
      :options="menuOptions"
      :value="selectedMenuKey"
      :root-indent="18"
      :indent="18"
      :theme-overrides="menuThemeOverrides"
      @update:value="handleMenuClick"
    />

    <!-- 创建歌单弹窗 -->
    <n-config-provider :theme-overrides="modalThemeOverrides">
      <n-modal
        v-model:show="createModalVisible"
        preset="dialog"
        title="创建歌单"
        :mask-closable="true"
      >
        <n-form :model="newPlaylist">
          <n-form-item label="歌单名称" required>
            <n-input
              ref="nameInputRef"
              v-model:value="newPlaylist.name"
              placeholder="请输入歌单名称"
              :maxlength="40"
              clearable
              @keyup.enter="handleCreatePlaylist"
            />
          </n-form-item>
          <n-form-item label="歌单描述">
            <n-input
              v-model:value="newPlaylist.description"
              type="textarea"
              placeholder="请输入歌单描述"
              :maxlength="200"
              :rows="3"
            />
          </n-form-item>
        </n-form>
        <template #action>
          <n-button @click="handleCancelCreate">取消</n-button>
          <n-button type="primary" :loading="createLoading" @click="handleCreatePlaylist"
            >创建</n-button
          >
        </template>
      </n-modal>
    </n-config-provider>
  </n-layout-sider>
</template>

<script setup>
import { ref, onMounted, nextTick, toRaw, watch, computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIndexStore } from '@/stores/indexStore'
import { usePlaylistStore } from '@/stores/playlistStore'
import { useUserStore } from '@/stores/userStore'
import { useSearchStore } from '@/stores/searchStore'
import { storeToRefs } from 'pinia'
import { useMessage, useDialog, NIcon, useThemeVars } from 'naive-ui'
import { ROUTE_NAMES } from '@/router/routeNames'
import { normalizeCoverUrl } from '@/utils/image'
import {
  HomeOutline,
  HeadsetOutline,
  FolderOutline,
  AddOutline,
  ListOutline,
  StarOutline,
  TrashOutline,
  CreateOutline,
  PersonOutline,
  HeartOutline,
  SearchOutline,
  SparklesOutline
} from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const dialog = useDialog()
const themeVars = useThemeVars()
const indexStore = useIndexStore()
const playlistStore = usePlaylistStore()
const userStore = useUserStore()
const searchStore = useSearchStore()

// 搜索（由顶栏迁移至侧边栏）
const searchText = ref('')
const doSearch = () => {
  const keyword = searchText.value.trim()
  if (!keyword) return
  searchStore.setSearchKeyword(keyword)
  router.push({ name: ROUTE_NAMES.SONG_SEARCH })
}

// 深色玻璃侧栏：菜单统一浅色
const menuThemeOverrides = {
  itemTextColor: 'rgba(255, 255, 255, 0.7)',
  itemTextColorHover: '#ffffff',
  itemTextColorActive: '#ffffff',
  itemTextColorActiveHover: '#ffffff',
  itemTextColorChildActive: '#ffffff',
  itemTextColorChildActiveHover: '#ffffff',
  itemIconColor: 'rgba(255, 255, 255, 0.6)',
  itemIconColorHover: '#ffffff',
  itemIconColorActive: '#ffffff',
  itemIconColorActiveHover: '#ffffff',
  itemIconColorChildActive: '#ffffff',
  itemColorHover: 'rgba(255, 255, 255, 0.08)',
  itemColorActive: 'rgba(255, 255, 255, 0.14)',
  itemColorActiveHover: 'rgba(255, 255, 255, 0.18)',
  itemColorActiveCollapsed: 'rgba(255, 255, 255, 0.14)',
  arrowColor: 'rgba(255, 255, 255, 0.5)',
  arrowColorHover: '#ffffff',
  arrowColorActive: '#ffffff',
  arrowColorChildActive: '#ffffff',
  groupTextColor: 'rgba(255, 255, 255, 0.45)'
}

// 创建歌单弹窗：玻璃底跟随明暗主题
const modalThemeOverrides = {
  Dialog: {
    color: 'var(--glass-panel-bg, rgba(24, 26, 32, 0.9))'
  }
}

const siderStyle = computed(() => {
  const sidebarBg = themeVars.value.cardColor || themeVars.value.bodyColor
  return {
    '--n-color': sidebarBg,
    backgroundColor: sidebarBg
  }
})

const { selectedPlaylistKey } = storeToRefs(indexStore)
const { createdPlaylists, favoritePlaylists, userPlaylists } = storeToRefs(playlistStore)
const { userInfo, isLoggedIn } = storeToRefs(userStore)

// 计算属性：分离"我喜欢的音乐"和其他在线歌单
const likedPlaylist = computed(() => {
  if (userPlaylists.value.length > 0) {
    const first = userPlaylists.value[0]
    if (first.name.includes('喜欢的音乐')) return first
    return userPlaylists.value.find((p) => p.name.includes('喜欢的音乐')) || null
  }
  return null
})

const filteredUserPlaylists = computed(() => {
  if (likedPlaylist.value) return userPlaylists.value.filter((p) => p.id !== likedPlaylist.value.id)
  return userPlaylists.value
})

// 网易云账号下自己创建的 / 收藏的歌单（收藏状态与手机端互通）
const cloudCreatedPlaylists = computed(() =>
  filteredUserPlaylists.value.filter((p) => !p.subscribed)
)
const cloudSubscribedPlaylists = computed(() =>
  filteredUserPlaylists.value.filter((p) => p.subscribed)
)

const NAV_ROUTE_NAMES = [ROUTE_NAMES.MAIN_PAGE, ROUTE_NAMES.MY_MUSIC, ROUTE_NAMES.SONG_SEARCH]

// 渲染图标
const renderIcon = (icon) => () => h(NIcon, null, { default: () => h(icon) })

// 渲染歌单封面缩略图（无封面时回退到通用图标），对标 Spotify/Apple Music 侧栏
const renderPlaylistCover = (playlist, FallbackIcon) => () => {
  const raw = playlist?.cover || playlist?.coverImgUrl || playlist?.picUrl || ''
  const src = normalizeCoverUrl(raw, 48)
  if (src) {
    return h('img', {
      src,
      width: 20,
      height: 20,
      alt: '',
      style:
        'width: 20px; height: 20px; border-radius: 4px; object-fit: cover; display: block; flex-shrink: 0;',
      onError: (e) => {
        e.target.style.display = 'none'
      }
    })
  }
  return h(NIcon, null, { default: () => h(FallbackIcon) })
}

// 渲染带编辑/删除按钮的歌单项
const renderPlaylistLabel =
  (playlist, { onDelete, onRename }) =>
  () =>
    h(
      'div',
      {
        style: 'display: flex; align-items: center; justify-content: space-between; width: 100%;'
      },
      [
        h(
          'span',
          { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;' },
          playlist.name
        ),
        h(
          'div',
          {
            style: 'display: flex; align-items: center; gap: 8px; margin-left: 8px;'
          },
          [
            onRename &&
              h(
                NIcon,
                {
                  size: 14,
                  style: 'opacity: 0; cursor: pointer; flex-shrink: 0; transition: opacity 0.2s;',
                  class: 'rename-icon',
                  onClick: (e) => {
                    e.stopPropagation()
                    onRename(playlist)
                  }
                },
                { default: () => h(CreateOutline) }
              ),
            h(
              NIcon,
              {
                size: 14,
                style: 'opacity: 0; cursor: pointer; flex-shrink: 0; transition: opacity 0.2s;',
                class: 'delete-icon',
                onClick: (e) => {
                  e.stopPropagation()
                  onDelete(playlist)
                }
              },
              { default: () => h(TrashOutline) }
            )
          ]
        )
      ]
    )

// 菜单选项
const menuOptions = computed(() => {
  const options = [
    {
      label: '发现',
      key: ROUTE_NAMES.MAIN_PAGE,
      icon: renderIcon(HomeOutline)
    },
    {
      label: '我的音乐',
      key: ROUTE_NAMES.MY_MUSIC,
      icon: renderIcon(HeadsetOutline)
    },
    {
      label: 'AI 助手',
      key: 'ai-assistant',
      icon: renderIcon(SparklesOutline)
    },
    { type: 'divider' },
    {
      label: () =>
        h(
          'div',
          {
            style:
              'display: flex; align-items: center; justify-content: space-between; width: 100%;'
          },
          [
            h('span', '本地歌单'),
            h(
              NIcon,
              {
                size: 16,
                style: 'cursor: pointer; opacity: 0.7;margin-right: 10px; flex-shrink: 0;',
                onClick: (e) => {
                  e.stopPropagation()
                  showCreateModal()
                }
              },
              { default: () => h(AddOutline) }
            )
          ]
        ),
      key: 'my-playlists',
      icon: renderIcon(FolderOutline),
      children: [
        {
          label: `我创建的歌单 (${createdPlaylists.value.length})`,
          key: 'created-playlists',
          icon: renderIcon(ListOutline),
          children:
            createdPlaylists.value.length > 0
              ? createdPlaylists.value.map((playlist) => ({
                  label: renderPlaylistLabel(playlist, {
                    onDelete: handleDeletePlaylist,
                    onRename: handleRenamePlaylist
                  }),
                  key: `created-${playlist.id}`,
                  icon: renderPlaylistCover(playlist, ListOutline)
                }))
              : [{ label: '暂无歌单', key: 'no-created', disabled: true }]
        },
        {
          label: `本地收藏 (${favoritePlaylists.value.length})`,
          key: 'favorite-playlists',
          icon: renderIcon(StarOutline),
          children:
            favoritePlaylists.value.length > 0
              ? favoritePlaylists.value.map((playlist) => ({
                  label: renderPlaylistLabel(playlist, { onDelete: handleDeleteFavoritePlaylist }),
                  key: `favorite-${playlist.id}`,
                  icon: renderPlaylistCover(playlist, StarOutline)
                }))
              : [{ label: '暂无收藏', key: 'no-favorite', disabled: true }]
        }
      ]
    }
  ]

  // 如果有喜欢的音乐
  if (likedPlaylist.value || filteredUserPlaylists.value.length > 0) {
    options.push({ type: 'divider' })
  }

  if (likedPlaylist.value) {
    options.push({
      label: '我喜欢的音乐',
      key: `user-${likedPlaylist.value.id}`,
      icon: () => h(NIcon, { color: '#f53f3f' }, { default: () => h(HeartOutline) })
    })
  }

  if (cloudCreatedPlaylists.value.length > 0) {
    options.push({
      label: `创建的歌单 (${cloudCreatedPlaylists.value.length})`,
      key: 'cloud-created',
      icon: renderIcon(PersonOutline),
      children: cloudCreatedPlaylists.value.map((playlist) => ({
        label: playlist.name,
        key: `user-${playlist.id}`,
        icon: renderPlaylistCover(playlist, ListOutline)
      }))
    })
  }

  if (cloudSubscribedPlaylists.value.length > 0) {
    options.push({
      label: `收藏的歌单 (${cloudSubscribedPlaylists.value.length})`,
      key: 'cloud-subscribed',
      icon: renderIcon(StarOutline),
      children: cloudSubscribedPlaylists.value.map((playlist) => ({
        label: renderPlaylistLabel(playlist, { onDelete: handleUnsubscribeCloudPlaylist }),
        key: `user-${playlist.id}`,
        icon: renderPlaylistCover(playlist, ListOutline)
      }))
    })
  }

  return options
})

// 创建歌单相关
const nameInputRef = ref(null)
const createModalVisible = ref(false)
const createLoading = ref(false)
const newPlaylist = ref({ name: '', description: '' })

const selectedMenuKey = computed(() => {
  if (route.name === ROUTE_NAMES.PLAYLIST_DETAIL && selectedPlaylistKey.value) {
    return selectedPlaylistKey.value
  }
  return NAV_ROUTE_NAMES.includes(route.name) ? route.name : ROUTE_NAMES.MAIN_PAGE
})

const handleMenuClick = (key) => {
  // 忽略空值或禁用项
  if (!key || key.startsWith('no-')) return

  // AI 助手：打开独立 AI 窗口（原悬浮球的功能）
  if (key === 'ai-assistant') {
    void globalThis?.window?.api?.openAiWindow?.()
    return
  }

  // 导航路由
  if (NAV_ROUTE_NAMES.includes(key)) {
    indexStore.setSelectedPlaylistKey(null)
    router.push({ name: key })
    return
  }

  // 歌单点击
  if (key.startsWith('created-') || key.startsWith('favorite-') || key.startsWith('user-')) {
    const [type, id] = key.split('-')
    let playlist = null

    if (type === 'created') {
      playlist = createdPlaylists.value.find((p) => String(p.id) === id)
    } else if (type === 'favorite') {
      playlist = favoritePlaylists.value.find((p) => String(p.id) === id)
    } else if (type === 'user') {
      playlist = userPlaylists.value.find((p) => String(p.id) === id)
    }

    if (playlist) handlePlaylistClick(playlist)
  }
}

const showCreateModal = () => {
  createModalVisible.value = true
  newPlaylist.value = { name: '', description: '' }
  nextTick(() => nameInputRef.value?.focus())
}

const handleCreatePlaylist = async () => {
  if (!newPlaylist.value.name.trim()) {
    message.warning('请输入歌单名称')
    return
  }

  createLoading.value = true
  try {
    const result = await playlistStore.createLocalPlaylist(toRaw(newPlaylist.value))
    if (result) {
      message.success('歌单创建成功')
      newPlaylist.value = { name: '', description: '' }
      createModalVisible.value = false
    } else {
      message.error('歌单创建失败')
    }
  } catch (error) {
    console.error('创建歌单失败:', error)
    message.error('歌单创建失败')
  } finally {
    createLoading.value = false
  }
}

const handleCancelCreate = () => {
  createModalVisible.value = false
  newPlaylist.value = { name: '', description: '' }
}

const handlePlaylistClick = (playlist) => {
  const isFavorite = favoritePlaylists.value.some((item) => item.id === playlist.id)
  const playlistType = playlist.isLocal ? 'created' : isFavorite ? 'favorite' : 'user'
  const playlistKey = `${playlistType}-${playlist.id}`

  indexStore.setSelectedPlaylistKey(playlistKey)
  playlistStore.setCurrentPlaylist(playlist)

  if (
    route.name === ROUTE_NAMES.PLAYLIST_DETAIL &&
    String(route.params.id || '') === String(playlist.id)
  ) {
    indexStore.forceRefresh()
  } else {
    router.push({ name: ROUTE_NAMES.PLAYLIST_DETAIL, params: { id: String(playlist.id) } })
  }
}

const handleDeletePlaylist = async (playlist) => {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除歌单 "${playlist.name}" 吗？此操作无法撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const success = await playlistStore.deleteLocalPlaylist(playlist.id)
        if (success) {
          message.success('歌单已删除')
          if (playlistStore.currentPlaylistInfo.id === playlist.id) {
            router.push({ name: ROUTE_NAMES.MAIN_PAGE })
          }
        } else {
          message.error('删除失败')
        }
      } catch (error) {
        console.error('删除歌单失败:', error)
        message.error('删除失败')
      }
    }
  })
}

const handleUnsubscribeCloudPlaylist = (playlist) => {
  dialog.warning({
    title: '确认取消收藏',
    content: `确定要在网易云取消收藏歌单 "${playlist.name}" 吗？`,
    positiveText: '取消收藏',
    negativeText: '保留',
    onPositiveClick: async () => {
      try {
        const result = await playlistStore.toggleSubscribePlaylist(playlist, false)
        if (result.success) message.success('已取消收藏')
        else message.error(result.message || '取消收藏失败')
      } catch (error) {
        console.error('取消收藏失败:', error)
        message.error('操作失败')
      }
    }
  })
}

const handleDeleteFavoritePlaylist = async (playlist) => {
  dialog.warning({
    title: '确认取消收藏',
    content: `确定要取消收藏歌单 "${playlist.name}" 吗？`,
    positiveText: '取消收藏',
    negativeText: '保留',
    onPositiveClick: async () => {
      try {
        const success = await playlistStore.removeFromFavoritePlaylist(playlist.id)
        if (success) {
          message.success('已取消收藏')
          if (playlistStore.currentPlaylistInfo.id === playlist.id) {
            router.push({ name: ROUTE_NAMES.MAIN_PAGE })
          }
        } else {
          message.error('取消收藏失败')
        }
      } catch (error) {
        console.error('取消收藏失败:', error)
        message.error('操作失败')
      }
    }
  })
}

const handleRenamePlaylist = (playlist) => {
  const renameDraft = ref(playlist.name || '')

  dialog.create({
    title: '重命名歌单',
    positiveText: '保存',
    negativeText: '取消',
    content: () =>
      h('div', { style: 'margin-top: 8px;' }, [
        h(
          'div',
          { style: 'margin-bottom: 8px; color: var(--n-text-color-2); font-size: 13px;' },
          '请输入新的歌单名称'
        ),
        h('input', {
          value: renameDraft.value,
          maxlength: 40,
          style:
            'width: 100%; height: 34px; border: 1px solid var(--n-border-color); border-radius: 6px; padding: 0 10px; outline: none; background: var(--n-color); color: var(--n-text-color);',
          onInput: (e) => {
            renameDraft.value = e.target.value
          }
        })
      ]),
    onPositiveClick: async () => {
      const name = String(renameDraft.value || '').trim()
      if (!name) {
        message.warning('歌单名称不能为空')
        return false
      }
      if (name === playlist.name) {
        return true
      }

      const updated = await playlistStore.updateLocalPlaylist(playlist.id, { name })
      if (!updated) {
        message.error('重命名失败')
        return false
      }

      if (playlistStore.currentPlaylistInfo.id === playlist.id) {
        playlistStore.setCurrentPlaylist({ ...playlistStore.currentPlaylistInfo, name })
      }
      message.success('歌单名称已更新')
      return true
    }
  })
}

// 加载歌单数据
onMounted(async () => {
  await playlistStore.loadLocalPlaylists()

  if (isLoggedIn.value && userInfo.value) {
    const uid = userInfo.value.userId || userInfo.value.id
    if (uid) await playlistStore.loadUserPlaylists(uid, 1000)
  }
})

// 监听登录状态变化
watch(isLoggedIn, async (newValue) => {
  if (newValue && userInfo.value) {
    const uid = userInfo.value.userId || userInfo.value.id
    if (uid) await playlistStore.loadUserPlaylists(uid, 1000)
  } else {
    playlistStore.userPlaylists = []
    playlistStore.likedSongIds = new Set()
  }
})
</script>

<style scoped lang="scss">
.sidebar-search {
  padding: 14px 12px 6px;

  :deep(.n-input) {
    --n-color: rgba(255, 255, 255, 0.08);
    --n-color-focus: rgba(255, 255, 255, 0.12);
    --n-text-color: rgba(255, 255, 255, 0.9);
    --n-placeholder-color: rgba(255, 255, 255, 0.4);
    --n-icon-color: rgba(255, 255, 255, 0.5);
    --n-icon-color-hover: rgba(255, 255, 255, 0.8);
    --n-border: 1px solid rgba(255, 255, 255, 0.12);
    --n-border-hover: 1px solid rgba(255, 255, 255, 0.24);
    --n-border-focus: 1px solid rgba(255, 255, 255, 0.36);
    --n-box-shadow-focus: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }
}

.sidebar {
  background-color: var(--glass-shell-bg, rgba(20, 22, 28, 0.62)) !important;
  backdrop-filter: blur(24px) saturate(150%);
  border-right: 1px solid var(--glass-shell-border, rgba(255, 255, 255, 0.08));
  height: calc(100vh - 60px - 80px);
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  :deep(.n-layout-sider-scroll-container),
  :deep(.n-layout-sider-content) {
    background-color: transparent !important;
  }
}

// Naive UI 菜单样式覆盖
:deep(.n-menu) {
  background: transparent;

  .n-menu-item-content {
    &:hover .delete-icon,
    &:hover .rename-icon {
      opacity: 1 !important;
    }
  }

  .n-menu-item-content--selected {
    font-weight: 600;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 60%;
      background: var(--n-item-text-color-active);
      border-radius: 0 2px 2px 0;
    }
  }
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
