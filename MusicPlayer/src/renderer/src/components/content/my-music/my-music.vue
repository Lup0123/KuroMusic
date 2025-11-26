<template>
  <div class="my-music">
    <!-- 顶部横幅 -->
    <div class="hero-banner">
      <div class="banner-bg"></div>
      <div class="banner-content">
        <div class="banner-left">
          <div class="icon-wrapper">
            <icon-list :size="48" />
          </div>
          <div class="banner-text">
            <span class="banner-label">音乐库</span>
            <h1 class="banner-title">我的收藏</h1>
            <div class="banner-stats">
              <span class="stat-item">
                <icon-music :size="16" />
                {{ musicList.length }} 首歌曲
              </span>
              <span class="stat-divider">•</span>
              <span class="stat-item">
                <icon-user :size="16" />
                {{ artistCount }} 位艺术家
              </span>
              <span class="stat-divider">•</span>
              <span class="stat-item">
                <icon-folder :size="16" />
                {{ albumCount }} 张专辑
              </span>
            </div>
          </div>
        </div>
        <div class="banner-actions">
          <a-button
            type="primary"
            size="large"
            class="primary-btn"
            @click="handleImportMusic"
          >
            <template #icon>
              <icon-plus />
            </template>
            导入音乐
          </a-button>
          <a-button size="large" class="secondary-btn" @click="handleRefresh">
            <template #icon>
              <icon-refresh />
            </template>
          </a-button>
        </div>
      </div>
    </div>

    <!-- 控制栏 -->
    <div class="control-bar">
      <div class="control-left">
        <a-input-search
          v-model="filterKeyword"
          placeholder="搜索音乐库..."
          allow-clear
          class="search-box"
        >
          <template #prefix>
            <icon-search />
          </template>
        </a-input-search>
      </div>
      <div class="control-right">
        <a-select
          v-model="sortBy"
          class="sort-select"
          :trigger-props="{ contentClass: 'sort-dropdown' }"
        >
          <template #prefix>
            <icon-sort />
          </template>
          <a-option value="name"> <icon-font-colors /> 按名称 </a-option>
          <a-option value="artist"> <icon-user /> 按艺术家 </a-option>
          <a-option value="album"> <icon-folder /> 按专辑 </a-option>
          <a-option value="addTime"> <icon-clock-circle /> 按添加时间 </a-option>
        </a-select>
      </div>
    </div>

    <!-- 歌曲列表区域 -->
    <div class="songs-container">
      <div class="songs-wrapper" v-if="filteredMusicList.length > 0">
        <!-- 表头 -->
        <div class="table-header">
          <div class="th th-index">#</div>
          <div class="th th-cover"></div>
          <div class="th th-title">标题</div>
          <div class="th th-artist">艺术家</div>
          <div class="th th-album">专辑</div>
          <div class="th th-duration">
            <icon-clock-circle :size="14" />
          </div>
          <div class="th th-actions"></div>
        </div>

        <!-- 歌曲列表 -->
        <div class="songs-list">
          <div
            v-for="(song, index) in filteredMusicList"
            :key="song.id"
            class="song-row"
            :class="{
              'is-playing': currentSong?.id === song.id,
              'is-active': currentSong?.id === song.id && isPlaying,
            }"
            @click="handlePlayMusic(song)"
          >
            <!-- 序号 / 播放按钮 -->
            <div class="td td-index">
              <span class="row-number">{{ String(index + 1).padStart(2, "0") }}</span>
              <div class="play-icon-wrapper">
                <icon-play-arrow-fill v-if="currentSong?.id !== song.id" :size="18" />
                <icon-sound-fill v-else :size="18" class="sound-wave" />
              </div>
            </div>

            <!-- 封面 -->
            <div class="td td-cover">
              <div class="cover-box">
                <a-image
                  :src="song.cover || defaultCover"
                  :width="40"
                  :height="40"
                  fit="cover"
                  :preview="false"
                  class="cover-img"
                >
                  <template #error>
                    <div class="cover-error">
                      <icon-music :size="18" />
                    </div>
                  </template>
                </a-image>
              </div>
            </div>

            <!-- 标题 -->
            <div class="td td-title">
              <div class="title-content">
                <span class="song-title" :title="song.name">{{ song.name }}</span>
              </div>
            </div>

            <!-- 艺术家 -->
            <div class="td td-artist">
              <span class="artist-name" :title="song.artist">
                {{ song.artist || "未知艺术家" }}
              </span>
            </div>

            <!-- 专辑 -->
            <div class="td td-album">
              <span class="album-name" :title="song.album">
                {{ song.album || "未知专辑" }}
              </span>
            </div>

            <!-- 时长 -->
            <div class="td td-duration">
              <span class="duration-text">{{ song.duration || "--:--" }}</span>
            </div>

            <!-- 操作按钮 -->
            <div class="td td-actions">
              <div class="action-buttons">
                <a-button
                  type="text"
                  size="mini"
                  class="action-btn"
                  @click.stop="handleAddToPlaylist(song)"
                >
                  <template #icon>
                    <icon-plus :size="18" />
                  </template>
                </a-button>
                <a-button
                  type="text"
                  size="mini"
                  status="danger"
                  class="action-btn delete-btn"
                  @click.stop="handleDelete(song)"
                >
                  <template #icon>
                    <icon-delete :size="18" />
                  </template>
                </a-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-container">
        <div class="empty-content">
          <div class="empty-icon-bg">
            <icon-music :size="80" />
          </div>
          <h3 class="empty-title">音乐库是空的</h3>
          <p class="empty-desc">开始导入您喜爱的音乐，打造专属音乐收藏</p>
          <a-button
            type="primary"
            size="large"
            class="empty-action-btn"
            @click="handleImportMusic"
          >
            <template #icon>
              <icon-plus />
            </template>
            立即导入
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { Message, Modal } from "@arco-design/web-vue";
import { useSongStore } from "@/stores/songStore";
import { storeToRefs } from "pinia";
import {
  importMusicFromLocal,
  saveMusicListToLocal,
  loadMusicListFromLocal,
} from "./my-music-api";
import {
  IconPlus,
  IconRefresh,
  IconMusic,
  IconList,
  IconUser,
  IconFolder,
  IconSearch,
  IconPlayArrow,
  IconPlayArrowFill,
  IconDelete,
  IconSoundFill,
  IconClockCircle,
  IconSort,
  IconFontColors,
} from "@arco-design/web-vue/es/icon";

const defaultCover =
  "https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png";

const songStore = useSongStore();
const { playlist, currentSong, isPlaying } = storeToRefs(songStore);

const musicList = ref([]);
const filterKeyword = ref("");
const sortBy = ref("name");
const isLoading = ref(false);

const artistCount = computed(() => {
  return new Set(musicList.value.map((item) => item.artist)).size;
});

const albumCount = computed(() => {
  return new Set(musicList.value.map((item) => item.album)).size;
});

const filteredMusicList = computed(() => {
  let list = [...musicList.value];

  if (filterKeyword.value) {
    const keyword = filterKeyword.value.toLowerCase();
    list = list.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) ||
        item.artist.toLowerCase().includes(keyword) ||
        item.album.toLowerCase().includes(keyword)
    );
  }

  list.sort((a, b) => {
    switch (sortBy.value) {
      case "name":
        return a.name.localeCompare(b.name, "zh-CN");
      case "artist":
        return a.artist.localeCompare(b.artist, "zh-CN");
      case "album":
        return a.album.localeCompare(b.album, "zh-CN");
      case "addTime":
        return new Date(b.addTime) - new Date(a.addTime);
      default:
        return 0;
    }
  });

  return list;
});

const handleImportMusic = async () => {
  try {
    isLoading.value = true;
    const importedFiles = await importMusicFromLocal();

    if (importedFiles.length === 0) {
      Message.info("未选择任何文件");
      return;
    }

    musicList.value.push(...importedFiles);
    saveMusicListToLocal(musicList.value);
    Message.success(`成功导入 ${importedFiles.length} 首歌曲`);
  } catch (error) {
    console.error("导入音乐失败:", error);
    Message.error("导入音乐失败，请重试");
  } finally {
    isLoading.value = false;
  }
};

const handleRefresh = () => {
  musicList.value = loadMusicListFromLocal();
  Message.success("刷新成功");
};

const handlePlayMusic = async (song) => {
  try {
    // 本地音乐直接使用文件路径
    const songToPlay = {
      ...song,
      url: song.path, // 使用本地文件路径
    };
    songStore.play(songToPlay);
  } catch (error) {
    console.error("播放音乐失败:", error);
    Message.error("播放失败，请重试");
  }
};

const handleAddToPlaylist = (row) => {
  songStore.addToPlaylist(row);
  Message.success(`已添加到播放列表: ${row.name}`);
};

const handleDelete = (row) => {
  Modal.confirm({
    title: "提示",
    content: `确定要删除 "${row.name}" 吗?`,
    onOk: () => {
      const index = musicList.value.findIndex((item) => item.id === row.id);
      if (index > -1) {
        musicList.value.splice(index, 1);
        saveMusicListToLocal(musicList.value);
        Message.success("删除成功");
      }
    },
  });
};

onMounted(() => {
  if (window.api) {
    console.log("✅ Electron API 可用");
  } else {
    Message.warning("当前环境不支持导入本地音乐功能");
  }

  musicList.value = loadMusicListFromLocal();
});
</script>

<style scoped lang="scss">
@import "./my-music.scss";
</style>
