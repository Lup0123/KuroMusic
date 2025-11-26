<template>
  <div class="song-search-container">
    <!-- 搜索结果头部 -->
    <div class="search-result-header" v-if="hasSearched && !loading">
      <div class="header-content">
        <div class="search-info">
          <h1 class="search-keyword">{{ searchKeyword }}</h1>
          <p class="search-stats">
            找到 <span class="count">{{ totalCount }}</span> 首相关歌曲
          </p>
        </div>

        <!-- 操作按钮 -->
        <div
          class="header-actions"
          v-if="activeTab === 'songs' && currentResults.length > 0"
        >
          <a-button type="primary" size="large" @click="playAll">
            <template #icon>
              <icon-play-arrow-fill />
            </template>
            播放全部
          </a-button>
          <a-button size="large" @click="collectAll">
            <template #icon>
              <icon-folder-add />
            </template>
            收藏全部
          </a-button>
        </div>
      </div>
    </div>

    <!-- 搜索标签栏 -->
    <div class="search-tabs-wrapper" v-if="hasSearched">
      <div class="tabs-container">
        <div class="tab-list">
          <div
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeTab === tab.key }"
            @click="handleTabChange(tab.key)"
          >
            <component :is="tab.icon" class="tab-icon" />
            <span class="tab-title">{{ tab.title }}</span>
            <span class="tab-count" v-if="getTabCount(tab.key)">
              {{ getTabCount(tab.key) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 搜索结果内容 -->
    <div class="search-content" v-if="hasSearched">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-container">
        <a-spin :size="50" />
        <p class="loading-text">搜索中...</p>
      </div>

      <!-- 无结果 -->
      <a-empty
        v-else-if="!loading && currentResults.length === 0"
        description="暂无搜索结果"
        class="empty-result"
      />

      <!-- 单曲列表 -->
      <div v-else-if="activeTab === 'songs'" class="songs-result-container">
        <!-- 列表头部 -->
        <div class="list-header">
          <div class="header-col col-index">#</div>
          <div class="header-col col-title">标题</div>
          <div class="header-col col-album">专辑</div>
          <div class="header-col col-actions">喜欢</div>
          <div class="header-col col-duration">时长</div>
        </div>

        <!-- 歌曲列表 -->
        <div class="songs-list">
          <div
            v-for="(song, index) in paginatedResults"
            :key="song.id"
            class="song-row"
            :class="{
              active: currentSong?.id === song.id,
              playing: currentSong?.id === song.id && isPlaying,
            }"
            @dblclick="playSong(song)"
          >
            <!-- 序号/播放按钮 -->
            <div class="col-index">
              <span class="row-number">{{ indexMethod(index) }}</span>
              <div class="play-overlay">
                <a-button
                  type="text"
                  class="play-btn"
                  size="small"
                  @click.stop="playSong(song)"
                >
                  <template #icon>
                    <icon-play-arrow-fill
                      v-if="currentSong?.id !== song.id || !isPlaying"
                    />
                    <icon-pause v-else />
                  </template>
                </a-button>
              </div>
            </div>

            <!-- 歌曲信息 -->
            <div class="col-title">
              <div class="song-cover">
                <a-image :src="song.albumCover" fit="cover" :width="48" :height="48">
                  <template #error>
                    <div class="cover-placeholder">
                      <icon-music />
                    </div>
                  </template>
                </a-image>
                <div
                  class="cover-play-icon"
                  v-if="currentSong?.id === song.id && isPlaying"
                >
                  <icon-sound-fill />
                </div>
              </div>
              <div class="song-info">
                <div class="song-name-wrapper">
                  <span class="song-name" :title="song.name">{{ song.name }}</span>
                  <div class="song-tags">
                    <a-tag v-if="song.fee === 1 || song.fee === 4" color="red" size="mini"
                      >VIP</a-tag
                    >
                    <a-tag v-if="song.mvId" color="arcoblue" size="mini">MV</a-tag>
                  </div>
                </div>
                <div
                  class="song-artist"
                  :title="song.artist + (song.alias ? ' - ' + song.alias : '')"
                >
                  {{ song.artist }}
                  <span v-if="song.alias" class="song-alias">{{ song.alias }}</span>
                </div>
              </div>
            </div>

            <!-- 专辑 -->
            <div class="col-album" :title="song.album">
              {{ song.album }}
            </div>

            <!-- 喜欢按钮 -->
            <div class="col-actions">
              <a-button
                type="text"
                size="small"
                class="action-btn like-btn"
                @click.stop="toggleLike(song)"
              >
                <template #icon>
                  <icon-heart-fill v-if="song.liked" class="liked-icon" />
                  <icon-heart v-else />
                </template>
              </a-button>
            </div>

            <!-- 时长 -->
            <div class="col-duration">
              {{ song.duration }}
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <a-pagination
            v-model:current="currentPage"
            v-model:page-size="pageSize"
            :total="currentResults.length"
            :page-size-options="[30, 50, 100]"
            show-total
            show-jumper
            show-page-size
            @change="handleCurrentChange"
            @page-size-change="handleSizeChange"
          />
        </div>
      </div>

      <!-- 其他标签页 -->
      <div v-else class="other-tab-content">
        <a-empty description="该功能开发中..." />
      </div>
    </div>

    <!-- 未搜索提示 -->
    <div v-else class="welcome-state">
      <div class="welcome-content">
        <icon-search class="welcome-icon" />
        <h2>探索音乐世界</h2>
        <p>在顶部搜索栏输入关键词，开始你的音乐之旅</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { Message } from "@arco-design/web-vue";
import {
  IconSearch,
  IconPlayArrowFill,
  IconPause,
  IconFolderAdd,
  IconHeart,
  IconHeartFill,
  IconMusic,
  IconSoundFill,
  IconUser,
  IconFolder,
  IconFile,
  IconVoice,
} from "@arco-design/web-vue/es/icon";
import { useSearchStore } from "@/stores/searchStore";
import { useSongStore } from "@/stores/songStore";
import { storeToRefs } from "pinia";

const searchStore = useSearchStore();
const { searchKeyword, searchResults, activeTab, hasSearched, loading } = storeToRefs(
  searchStore
);

const {
  setSearchResults,
  setActiveTab,
  setHasSearched,
  setLoading,
  clearSearch,
} = searchStore;

const songStore = useSongStore();
const { currentSong, isPlaying } = storeToRefs(songStore);
const { play } = songStore;

// 标签页配置
const tabs = [
  { key: "songs", title: "单曲", icon: IconMusic },
  { key: "artists", title: "歌手", icon: IconUser },
  { key: "albums", title: "专辑", icon: IconFolder },
  { key: "playlists", title: "歌单", icon: IconFolder },
  { key: "mv", title: "MV", icon: IconVoice },
  { key: "lyrics", title: "歌词", icon: IconFile },
  { key: "voice", title: "声音", icon: IconVoice },
];

// 分页相关
const currentPage = ref(1);
const pageSize = ref(30);

// 执行搜索
const performSearch = async (keyword) => {
  if (!keyword || !keyword.trim()) {
    return;
  }

  setLoading(true);
  setHasSearched(true);

  try {
    const response = await window.api.search(keyword.trim());
    console.log("搜索结果:", response);
    const results = response.body.result;
    if (results && response) {
      setSearchResults(results);
      Message.success(`找到 ${results.songCount || 0} 首相关歌曲`);
    } else {
      Message.error("搜索失败，请重试");
      setSearchResults({ songs: [], songCount: 0 });
    }
  } catch (error) {
    console.error("搜索错误:", error);
    Message.error("搜索出错，请稍后重试");
    setSearchResults({ songs: [], songCount: 0 });
  } finally {
    setLoading(false);
  }
};

// 监听搜索关键词变化
watch(
  searchKeyword,
  (newKeyword) => {
    if (newKeyword && newKeyword.trim()) {
      performSearch(newKeyword);
      currentPage.value = 1;
    }
  },
  { immediate: false }
);

// 组件挂载时检查是否有搜索关键词
onMounted(() => {
  if (searchKeyword.value && searchKeyword.value.trim()) {
    performSearch(searchKeyword.value);
  }
});

const totalCount = computed(() => {
  return searchResults.value.trackCount || searchResults.value.songs?.length || 0;
});

const currentResults = computed(() => {
  if (activeTab.value === "songs") {
    return searchResults.value.songs || [];
  }
  return searchResults.value[activeTab.value] || [];
});

const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return currentResults.value.slice(start, end);
});

const indexMethod = (index) => {
  return String((currentPage.value - 1) * pageSize.value + index + 1).padStart(2, "0");
};

const getTabCount = (tabKey) => {
  if (tabKey === "songs") {
    return searchResults.value.trackCount || searchResults.value.songs?.length || 0;
  }
  const results = searchResults.value[tabKey];
  return results?.length || 0;
};

watch(activeTab, () => {
  currentPage.value = 1;
});

const handleSizeChange = (val) => {
  pageSize.value = val;
  currentPage.value = 1;
};

const handleCurrentChange = (val) => {
  currentPage.value = val;
  const container = document.querySelector(".search-content");
  if (container) {
    container.scrollTop = 0;
  }
};

const handleTabChange = (tab) => {
  setActiveTab(tab);
};

const playSong = async (song) => {
  try {
    const response = await window.api.getSongUrl(song.id, "standard");
    const result = response.body;

    if (result.code == 200) {
      const fullSong = {
        id: song.id,
        name: song.name,
        artist: song.artist,
        album: song.album,
        cover: song.albumCover || "https://via.placeholder.com/50",
        duration: song.duration,
        dt: song.durationMs,
      };
      play(fullSong);
      Message.success(`开始播放: ${song.name}`);
    } else {
      Message.error("无法获取播放链接");
    }
  } catch (error) {
    Message.error("获取播放链接失败");
    console.error("播放错误:", error);
  }
};

const toggleLike = (song) => {
  song.liked = !song.liked;
  Message.success(song.liked ? "已添加到我喜欢" : "已取消喜欢");
};

const playAll = async () => {
  if (currentResults.value.length > 0) {
    const firstSong = currentResults.value[0];
    await playSong(firstSong);
    Message.success(`开始播放全部 ${currentResults.value.length} 首歌曲`);
  }
};

const collectAll = () => {
  Message.info(`已将 ${currentResults.value.length} 首歌曲添加到收藏`);
};
</script>

<style scoped lang="scss">
.song-search-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-1);
  position: relative;
  padding: 0 0 32px;
}

// 搜索结果头部
.search-result-header {
  padding: 10px 48px 32px;
  background: linear-gradient(
    135deg,
    var(--color-primary-light-1) 0%,
    var(--color-bg-2) 50%,
    var(--color-bg-1) 100%
  );
  border-bottom: 1px solid var(--color-border-2);
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: -50%;
    right: -10%;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, var(--color-primary-light-2) 0%, transparent 70%);
    opacity: 0.3;
    pointer-events: none;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    max-width: 1600px;
    margin: 0 auto;
    position: relative;
    z-index: 1;

    .search-info {
      flex: 1;

      .search-keyword {
        font-size: 42px;
        font-weight: 800;
        color: var(--color-text-1);
        margin: 0 0 12px 0;
        letter-spacing: -1px;
        background: linear-gradient(
          135deg,
          var(--color-text-1) 0%,
          var(--color-primary-6) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .search-stats {
        font-size: 16px;
        color: var(--color-text-2);
        margin: 0;
        font-weight: 500;

        .count {
          color: var(--color-primary-6);
          font-weight: 700;
          font-size: 18px;
          padding: 2px 8px;
          background: var(--color-primary-light-1);
          border-radius: 4px;
          margin: 0 4px;
        }
      }
    }

    .header-actions {
      display: flex;
      gap: 12px;

      :deep(.arco-btn) {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        font-weight: 500;

        &.arco-btn-primary {
          background: linear-gradient(
            135deg,
            rgb(var(--primary-6)) 0%,
            rgb(var(--primary-5)) 100%
          );
          border: none;

          &:hover {
            box-shadow: 0 4px 12px rgba(var(--primary-6), 0.3);
            transform: translateY(-2px);
          }
        }
      }
    }
  }
}

// 标签栏
.search-tabs-wrapper {
  background: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border-2);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

  .tabs-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 48px;

    .tab-list {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }

      .tab-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 24px;
        cursor: pointer;
        color: var(--color-text-2);
        border-bottom: 3px solid transparent;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        white-space: nowrap;
        user-select: none;
        position: relative;
        border-radius: 8px 8px 0 0;

        &::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 80%;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--color-primary-6) 50%,
            transparent 100%
          );
          border-radius: 2px;
          transition: transform 0.3s ease;
        }

        .tab-icon {
          font-size: 18px;
          transition: transform 0.3s ease;
        }

        .tab-title {
          font-size: 14px;
          font-weight: 500;
        }

        .tab-count {
          padding: 2px 10px;
          background: var(--color-fill-2);
          border-radius: 12px;
          font-size: 12px;
          color: var(--color-text-3);
          font-weight: 600;
          transition: all 0.3s ease;
        }

        &:hover {
          color: var(--color-text-1);
          background: var(--color-fill-1);

          .tab-icon {
            transform: scale(1.1);
          }

          .tab-title {
            color: var(--color-text-1);
          }
        }

        &.active {
          color: var(--color-primary-6);
          font-weight: 600;

          &::after {
            transform: translateX(-50%) scaleX(1);
          }

          .tab-count {
            background: var(--color-primary-light-2);
            color: var(--color-primary-6);
          }

          .tab-icon {
            transform: scale(1.15);
            color: var(--color-fill-4);
          }

          .tab-title {
            color: var(--color-text-1);
          }
        }
      }
    }
  }
}

// 搜索内容
.search-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 48px 48px;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;

  // 滚动条样式
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border-3);
    border-radius: 4px;
    transition: background 0.3s ease;

    &:hover {
      background: var(--color-border-4);
    }
  }
}

// 歌曲列表容器
.songs-result-container {
  .list-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    margin-bottom: 12px;
    color: var(--color-text-3);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: var(--color-fill-1);
    border-radius: 8px;
    border: 1px solid var(--color-border-2);

    .header-col {
      &.col-index {
        width: 60px;
        text-align: center;
      }

      &.col-title {
        flex: 1;
        min-width: 0;
      }

      &.col-album {
        width: 280px;
        padding: 0 16px;
      }

      &.col-actions {
        width: 80px;
        text-align: center;
      }

      &.col-duration {
        width: 100px;
        text-align: right;
      }
    }
  }

  .songs-list {
    .song-row {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      margin-bottom: 4px;
      border: 1px solid transparent;

      &::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: 10px;
        background: linear-gradient(
          135deg,
          var(--color-primary-light-1) 0%,
          transparent 100%
        );
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      &:hover {
        background: var(--color-fill-2);
        border-color: var(--color-border-2);
        transform: translateX(4px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

        &::before {
          opacity: 0.5;
        }

        .play-overlay {
          opacity: 1;
        }

        .row-number {
          opacity: 0;
        }
      }

      &.active {
        background: var(--color-primary-light-1);
        border-color: var(--color-primary-light-3);

        .song-name {
          color: var(--color-primary-6);
          font-weight: 600;
        }
      }

      &.playing {
        .song-cover {
          border: 2px solid var(--color-primary-6);
          box-shadow: 0 0 0 4px var(--color-primary-light-2);
        }
      }

      .col-index {
        width: 60px;
        text-align: center;
        position: relative;

        .row-number {
          font-size: 15px;
          color: var(--color-text-3);
          font-weight: 600;
          transition: opacity 0.2s;
        }

        .play-overlay {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          opacity: 0;
          transition: opacity 0.2s;

          .play-btn {
            color: var(--color-primary-6);
            font-size: 22px;
            transition: all 0.2s;

            &:hover {
              transform: scale(1.2);
            }
          }
        }
      }

      .col-title {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;

        .song-cover {
          position: relative;
          flex-shrink: 0;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.3s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

          &:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          }

          .cover-placeholder {
            width: 48px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(
              135deg,
              var(--color-fill-2) 0%,
              var(--color-fill-3) 100%
            );
            color: var(--color-text-4);
          }

          .cover-play-icon {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(2px);
            color: var(--color-primary-6);
            font-size: 24px;
            animation: pulse 1.5s infinite;
          }
        }

        .song-info {
          flex: 1;
          min-width: 0;

          .song-name-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;

            .song-name {
              font-size: 15px;
              font-weight: 500;
              color: var(--color-text-1);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              flex: 1;
              transition: color 0.3s ease;
            }

            .song-tags {
              display: flex;
              gap: 6px;
              flex-shrink: 0;

              :deep(.arco-tag) {
                font-weight: 600;
                border-radius: 4px;
              }
            }
          }

          .song-artist {
            font-size: 13px;
            color: var(--color-text-3);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            .song-alias {
              margin-left: 6px;
              opacity: 0.7;
              font-style: italic;
            }
          }
        }
      }

      .col-album {
        width: 280px;
        padding: 0 16px;
        font-size: 13px;
        color: var(--color-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color 0.3s ease;

        &:hover {
          color: var(--color-text-1);
        }
      }

      .col-actions {
        width: 80px;
        text-align: center;

        .action-btn {
          opacity: 0;
          transition: all 0.2s;
          font-size: 20px;

          &:hover {
            transform: scale(1.2);
          }
        }

        .liked-icon {
          color: #f53f3f;
        }
      }

      &:hover .col-actions .action-btn {
        opacity: 1;
      }

      .col-actions .liked-icon {
        opacity: 1;
      }

      .col-duration {
        width: 100px;
        text-align: right;
        font-size: 13px;
        color: var(--color-text-3);
        font-variant-numeric: tabular-nums;
        font-weight: 500;
      }
    }
  }
}

// 分页
.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 48px 0 24px;

  :deep(.arco-pagination) {
    .arco-pagination-item {
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
      }

      &.arco-pagination-item-active {
        background: linear-gradient(
          135deg,
          rgb(var(--primary-5)) 40%,
          rgb(var(--primary-7)) 100%
        );
        font-weight: 600;
        color: var(--color-text-1);
      }
    }
  }
}

// 加载中
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 0;

  :deep(.arco-spin) {
    color: var(--color-primary-6);
  }

  .loading-text {
    margin-top: 24px;
    color: var(--color-text-2);
    font-size: 16px;
    font-weight: 500;
  }
}

// 空状态
.empty-result {
  padding: 120px 0;

  :deep(.arco-empty) {
    .arco-empty-image {
      font-size: 120px;
    }

    .arco-empty-description {
      font-size: 16px;
      color: var(--color-text-2);
      margin-top: 20px;
    }
  }
}

.other-tab-content {
  padding: 120px 0;
}

// 欢迎界面
.welcome-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at 50% 50%,
    var(--color-fill-1) 0%,
    var(--color-bg-1) 100%
  );

  .welcome-content {
    text-align: center;
    animation: fadeInUp 0.6s ease;

    .welcome-icon {
      font-size: 120px;
      color: var(--color-primary-6);
      margin-bottom: 32px;
      opacity: 0.8;
      animation: float 3s ease-in-out infinite;
    }

    h2 {
      font-size: 32px;
      font-weight: 700;
      color: var(--color-text-1);
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }

    p {
      font-size: 16px;
      color: var(--color-text-3);
      margin: 0;
      font-weight: 500;
    }
  }
}

// 动画
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(0.95);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}

// 响应式
@media (max-width: 1400px) {
  .search-result-header,
  .search-tabs-wrapper .tabs-container,
  .search-content {
    padding-left: 32px;
    padding-right: 32px;
  }
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 16px;
  }

  .col-album {
    display: none !important;
  }
}
</style>
