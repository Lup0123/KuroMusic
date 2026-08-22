<template>
  <n-layout-footer
    class="player-footer"
    :class="{ 'mini-mode': isMiniMode }"
    :style="{ height: '80px' }"
  >
    <div class="player-container">
      <!-- 当前播放歌曲信息 -->
      <div class="current-song" @click="!isMiniMode && goToLyric()">
        <div class="song-cover">
          <AppCover
            :src="currentSong.cover"
            :width="isMiniMode ? 40 : 50"
            :height="isMiniMode ? 40 : 50"
            :size="isMiniMode ? 80 : 100"
            :radius="6"
          />
        </div>
        <div class="song-info">
          <div class="song-title">{{ currentSong.name }}</div>
          <div class="song-artist">{{ currentSong.artist }}</div>
        </div>
        <n-button
          v-if="!isMiniMode"
          text
          size="small"
          :loading="isLikeUpdating"
          :disabled="!currentSong.id"
          @click.stop="handleToggleLike"
        >
          <template #icon
            ><n-icon>
              <Heart v-if="isCurrentSongLiked" />
              <HeartOutline v-else /> </n-icon
          ></template>
        </n-button>
      </div>

      <!-- 播放控制 -->
      <div class="player-controls">
        <div class="control-buttons">
          <n-button text size="large" @click="playPrevious">
            <template #icon
              ><n-icon size="20"><PlaySkipBackOutline /></n-icon
            ></template>
          </n-button>
          <n-button type="primary" circle size="large" @click="togglePlay">
            <template #icon>
              <n-icon size="20">
                <PlayOutline v-if="!isPlaying" />
                <PauseOutline v-else />
              </n-icon>
            </template>
          </n-button>
          <n-button text size="large" @click="handlePlayNext">
            <template #icon
              ><n-icon size="20"><PlaySkipForwardOutline /></n-icon
            ></template>
          </n-button>
        </div>

        <!-- 进度条 -->
        <div class="progress-container" @click="!isMiniMode && goToLyric()">
          <span class="time-current">{{ formattedCurrentTime }}</span>
          <n-slider
            :value="progress"
            :tooltip="false"
            class="progress-slider"
            @update:value="handleProgressChange"
            @click.stop
          />
          <span class="time-total">{{ formattedDuration }}</span>
        </div>
      </div>

      <!-- 右侧功能 -->
      <div class="player-actions">
        <n-button
          v-if="!isMiniMode"
          text
          size="large"
          :title="playModeTooltip"
          @click="cyclePlayMode"
        >
          <template #icon>
            <n-badge v-if="playMode === 'single'" :value="1" :offset="[0, 8]" :show-zero="false">
              <n-icon><RepeatOutline /></n-icon>
            </n-badge>
            <n-icon v-else>
              <ShuffleOutline v-if="playMode === 'random'" />
              <RepeatOutline v-else />
            </n-icon>
          </template>
        </n-button>
        <n-button v-if="!isMiniMode" text size="large" @click="togglePlaylist">
          <template #icon
            ><n-icon><ListOutline /></n-icon
          ></template>
        </n-button>
        <n-button
          v-if="!isMiniMode"
          text
          size="large"
          :loading="isDownloading"
          @click="handleDownload"
        >
          <template #icon
            ><n-icon><DownloadOutline /></n-icon
          ></template>
        </n-button>
        <n-button v-if="!isMiniMode" text size="large" @click="goToLyric">
          <template #icon
            ><n-icon><DocumentTextOutline /></n-icon
          ></template>
        </n-button>
        <div v-if="!isMiniMode" class="volume-control">
          <n-icon size="20"><VolumeHighOutline /></n-icon>
          <n-slider
            :value="volume"
            :tooltip="false"
            style="width: 80px; margin-left: 8px"
            @update:value="handleVolumeChange"
          />
        </div>
        <n-button
          text
          size="large"
          :title="isMiniMode ? '退出迷你模式' : '迷你模式'"
          @click="toggleMiniMode"
        >
          <template #icon>
            <n-icon>
              <ContractOutline v-if="!isMiniMode" />
              <ExpandOutline v-else />
            </n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <audio
      ref="audioRef"
      @timeupdate="handleTimeUpdate"
      @loadedmetadata="handleLoadedMetadata"
      @ended="handleEnded"
      @error="handleError"
      @playing="handlePlaying"
    />
  </n-layout-footer>
</template>

<script setup>
import { ref, watch, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useSongStore } from "@/stores/songStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useUserStore } from "@/stores/userStore";
import { useIndexStore } from "@/stores/indexStore";
import { useAppFeedback } from "@/composables/useAppFeedback";
import {
  Heart,
  HeartOutline,
  PlaySkipBackOutline,
  PlayOutline,
  PauseOutline,
  PlaySkipForwardOutline,
  RepeatOutline,
  ShuffleOutline,
  ContractOutline,
  ExpandOutline,
  ListOutline,
  DownloadOutline,
  DocumentTextOutline,
  VolumeHighOutline,
} from "@vicons/ionicons5";
import { downloadSong } from "@/utils/downloadUtils";
import {
  getNextFallbackQuality,
  isLocalSong,
  buildSkipFeedbackMessage
} from "@/services/player/playbackFailover";
import { syncGlobalShortcutsFromStoredSettings } from "@/services/player/globalShortcuts";
import { syncCloseToTrayFromStoredSettings } from "@/services/desktopSettings";
import { syncAutoCheckUpdateFromStoredSettings } from "@/services/desktopSettings";
import AppCover from "@/components/common/AppCover.vue";

const router = useRouter();
const feedback = useAppFeedback();
const songStore = useSongStore();
const playlistStore = usePlaylistStore();
const userStore = useUserStore();
const indexStore = useIndexStore();
const {
  currentSong,
  isPlaying,
  progress,
  volume,
  formattedCurrentTime,
  formattedDuration,
  currentTime,
  playMode,
} = storeToRefs(songStore);
const { isLoggedIn, userInfo } = storeToRefs(userStore);
const { isMiniMode } = storeToRefs(indexStore);
const {
  togglePlay,
  playNext,
  playPrevious,
  togglePlaylist,
  cyclePlayMode,
  setCurrentTime,
  setDuration,
  setVolume,
  setProgress,
} = songStore;
const { toggleMiniMode } = indexStore;

const audioRef = ref(null);
const isDownloading = ref(false);
const isLikeUpdating = ref(false);
const failoverMap = new Map();
const skippedSongIds = new Set();
const skippedCount = ref(0);
let failoverInFlight = false;

const playModeTooltip = computed(() => {
  if (playMode.value === "random") return "随机播放（点击切换模式）";
  if (playMode.value === "single") return "单曲循环（点击切换模式）";
  return "列表循环（点击切换模式）";
});

function recordBehavior(type) {
  const song = currentSong.value;
  if (!song?.id) return;
  globalThis?.window?.api
    ?.behaviorRecordEvent?.({
      type,
      song: { id: song.id, name: song.name, artist: song.artist }
    })
    ?.catch?.(() => {});
}

const handlePlayNext = () => {
  playNext();
};

const handlePlaying = () => {
  if (skippedCount.value > 0) skippedCount.value = 0;
};

const handleFailoverSkip = () => {
  skippedCount.value += 1;
  feedback.error(buildSkipFeedbackMessage(skippedCount.value));
  songStore.setPlaying(false);
  setTimeout(() => {
    playNext({ auto: true });
  }, 500);
};

const handleError = async () => {
  const song = currentSong.value;
  const songId = String(song?.id || "");
  if (!songId || isLocalSong(song) || skippedSongIds.has(songId)) {
    handleFailoverSkip();
    return;
  }

  if (failoverInFlight) return;
  failoverInFlight = true;
  try {
    const settings = JSON.parse(localStorage.getItem("appSettings") || "{}");
    const baseQuality = settings.quality || "exhigh";
    const entry = failoverMap.get(songId) || { attemptedLevels: [] };

    while (true) {
      const nextQuality = getNextFallbackQuality(baseQuality, entry.attemptedLevels);
      if (!nextQuality) {
        skippedSongIds.add(songId);
        handleFailoverSkip();
        return;
      }
      entry.attemptedLevels.push(nextQuality);
      failoverMap.set(songId, entry);

      try {
        const response = await window.api.getSongUrl(song.id, nextQuality);
        const nextUrl = response?.body?.data?.[0]?.url;
        if (nextUrl && audioRef.value) {
          audioRef.value.src = nextUrl;
          audioRef.value.load();
          if (isPlaying.value) await audioRef.value.play();
          return;
        }
      } catch (error) {
        console.error("降级换源失败:", error);
      }
    }
  } finally {
    failoverInFlight = false;
  }
};

const isCurrentSongLiked = computed(() => {
  const songId = currentSong.value?.id;
  if (!songId) return false;
  return Boolean(currentSong.value?.liked) || playlistStore.isSongLiked(songId);
});

const handleToggleLike = async () => {
  if (!currentSong.value?.id) {
    feedback.warning("当前没有播放歌曲");
    return;
  }

  if (!isLoggedIn.value) {
    feedback.warning("请先登录后再操作");
    return;
  }

  if (isLikeUpdating.value) return;

  isLikeUpdating.value = true;
  try {
    const nextLiked = !isCurrentSongLiked.value;
    const success = await playlistStore.toggleLikeSong(currentSong.value.id, nextLiked);

    if (!success) {
      feedback.error("操作失败，请重试");
      return;
    }

    const targetSong = songStore.playlist.find(
      (song) => song.id === currentSong.value.id
    );
    if (targetSong) {
      targetSong.liked = nextLiked;
    }

    feedback.success(nextLiked ? "已添加到我喜欢的音乐" : "已取消喜欢");
    recordBehavior(nextLiked ? "like" : "unlike");
  } catch (error) {
    console.error("喜欢操作失败:", error);
    feedback.error("操作失败，请重试");
  } finally {
    isLikeUpdating.value = false;
  }
};

const handleDownload = async () => {
  if (!currentSong.value.id) {
    feedback.warning("当前没有播放歌曲");
    return;
  }
  isDownloading.value = true;
  try {
    await downloadSong(currentSong.value);
  } finally {
    isDownloading.value = false;
  }
};

const goToLyric = () => {
  if (!currentSong.value.id) {
    feedback.warning("当前没有播放歌曲");
    return;
  }
  const currentRoute = router.currentRoute.value;
  const nextQuery = { ...currentRoute.query };
  if (nextQuery.lyric === "1") delete nextQuery.lyric;
  else nextQuery.lyric = "1";
  router.push({ name: currentRoute.name, params: currentRoute.params, query: nextQuery });
};

watch(isPlaying, (newVal) => {
  if (!audioRef.value) return;
  if (newVal) audioRef.value.play().catch((err) => console.error("播放失败:", err));
  else audioRef.value.pause();
});

watch(
  () => currentSong.value.id,
  async (newId, oldId) => {
    if (!newId || newId === "" || newId === oldId) return;
    failoverMap.delete(String(newId));
    skippedSongIds.delete(String(newId));
    try {
      let songUrl = null;
      if (currentSong.value.url) songUrl = currentSong.value.url;
      else if (currentSong.value.path) songUrl = currentSong.value.path;
      else {
        const settings = JSON.parse(localStorage.getItem("appSettings") || "{}");
        const quality = settings.quality || "exhigh";
        const response = await window.api.getSongUrl(newId, quality);
        if (response?.body?.data?.[0]) songUrl = response.body.data[0].url;
      }
      if (songUrl && audioRef.value) {
        audioRef.value.src = songUrl;
        audioRef.value.load();
        if (isPlaying.value) await audioRef.value.play();
      } else {
        feedback.error("无法获取歌曲播放地址");
        songStore.setPlaying(false);
      }
    } catch (error) {
      console.error("加载歌曲失败:", error);
      feedback.error("歌曲加载失败");
      songStore.setPlaying(false);
    }
  },
  { immediate: true }
);

watch(volume, (newVolume) => {
  if (audioRef.value) audioRef.value.volume = newVolume / 100;
});
watch(currentTime, (newTime) => {
  if (!audioRef.value) return;
  if (Math.abs(audioRef.value.currentTime - newTime) > 0.5)
    audioRef.value.currentTime = newTime;
});

// ===== 媒体键（MediaSession）=====
const setupMediaSession = () => {
  if (!("mediaSession" in navigator)) return;
  try {
    const mediaSession = navigator.mediaSession;
    mediaSession.setActionHandler("play", () => songStore.setPlaying(true));
    mediaSession.setActionHandler("pause", () => songStore.setPlaying(false));
    mediaSession.setActionHandler("previoustrack", () => playPrevious());
    mediaSession.setActionHandler("nexttrack", () => playNext());
    mediaSession.setActionHandler("seekto", (details) => {
      if (typeof details?.seekTime === "number" && audioRef.value) {
        setCurrentTime(details.seekTime);
        audioRef.value.currentTime = details.seekTime;
      }
    });
  } catch (error) {
    console.warn("MediaSession 初始化失败:", error);
  }
};

watch(
  () => currentSong.value,
  (song) => {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song?.name || "",
        artist: song?.artist || "",
        album: song?.album || "",
        artwork: song?.cover ? [{ src: song.cover, sizes: "512x512" }] : [],
      });
    } catch (error) {
      console.warn("MediaSession 元数据更新失败:", error);
    }
  },
  { immediate: true }
);

watch(isPlaying, (playing) => {
  if ("mediaSession" in navigator) {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
});

// ===== 切歌桌面通知 =====
const showSongNotification = (song) => {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const notification = new Notification(song?.name || "", {
      body: song?.artist || "",
      icon: song?.cover || undefined,
      silent: true
    });
    notification.onclick = () => {
      window.api?.showWindow?.();
    };
  } catch (error) {
    console.warn("切歌通知展示失败:", error);
  }
};

watch(
  () => currentSong.value?.id,
  (newId, oldId) => {
    if (!newId || newId === "" || newId === oldId) return;
    showSongNotification(currentSong.value);
    recordBehavior("play");
  }
);

// ===== 托盘 / 主进程命令 =====
const handlePlayerCommand = (command) => {
  switch (command) {
    case "toggle-play":
      togglePlay();
      break;
    case "next":
      playNext();
      break;
    case "previous":
      playPrevious();
      break;
    case "toggle-mini":
      toggleMiniMode();
      break;
    default:
      break;
  }
};

const handleTimeUpdate = () => {
  if (audioRef.value) setCurrentTime(audioRef.value.currentTime);
};
const handleLoadedMetadata = () => {
  if (audioRef.value) setDuration(audioRef.value.duration);
};
const handleEnded = () => {
  recordBehavior("finish");
  const isSingleLoop = playMode.value === "single";
  playNext({ auto: true });
  if (isSingleLoop && audioRef.value) {
    audioRef.value.currentTime = 0;
    audioRef.value.play().catch((err) => console.error("单曲循环重播失败:", err));
  }
};
const handleProgressChange = (value) => {
  setProgress(value);
  if (audioRef.value?.duration)
    audioRef.value.currentTime = (value / 100) * audioRef.value.duration;
};
const handleVolumeChange = (value) => {
  setVolume(value);
};

onMounted(() => {
  window.api?.onPlayerCommand?.(handlePlayerCommand);
  setupMediaSession();

  syncGlobalShortcutsFromStoredSettings();
  syncCloseToTrayFromStoredSettings();
  syncAutoCheckUpdateFromStoredSettings();

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    try {
      Notification.requestPermission();
    } catch (error) {
      console.warn("通知权限请求失败:", error);
    }
  }

  if (audioRef.value) {
    audioRef.value.volume = volume.value / 100;
    songStore.audioElement = audioRef.value;
  }

  if (
    isLoggedIn.value &&
    userInfo.value?.userId &&
    playlistStore.likedSongIds.size === 0
  ) {
    playlistStore.loadLikedSongs(userInfo.value.userId);
  }
});
</script>

<style lang="scss" scoped>
// 播放器底部样式
.player-footer {
  background: var(--n-card-color);
  border-top: 1px solid var(--n-border-color);
  padding: 0;
  height: 80px;
  box-shadow: 0 -2px 12px var(--n-hover-color);
  backdrop-filter: blur(10px);

  .player-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 100%;
    padding: 0 24px;
    gap: 24px;
  }
}

// 迷你模式：紧凑顶置条
.player-footer.mini-mode {
  height: 100% !important;
  border-top: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0;

  .player-container {
    flex-direction: row;
    gap: 10px;
    padding: 0 10px;
    -webkit-app-region: drag;

    button,
    .n-slider {
      -webkit-app-region: no-drag;
    }
  }

  .current-song {
    width: auto;
    min-width: 0;
    flex: 0 1 auto;
    gap: 8px;
  }

  .song-cover {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    box-shadow: none;
  }

  .song-title {
    font-size: 13px;
  }

  .song-artist {
    font-size: 11px;
  }

  .player-controls {
    flex: 1;
    min-width: 0;
    width: auto;
    gap: 0;
    overflow: hidden;
  }

  .control-buttons {
    gap: 4px;
  }

  .progress-container {
    gap: 6px;
    min-width: 0;
  }

  .time-current,
  .time-total {
    display: none;
  }

  .progress-slider {
    min-width: 0;
    flex: 1;
  }

  .player-actions {
    width: auto;
    min-width: 0;
    gap: 4px;
  }
}

// 当前播放歌曲信息样式
.current-song {
  display: flex;
  align-items: center;
  width: 25%;
  min-width: 250px;
  gap: 12px;

  .song-cover {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: 0 4px 12px var(--n-pressed-color);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px var(--n-pressed-color);
    }

    :deep(.ant-image) {
      width: 100%;
      height: 100%;
    }
  }

  .song-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;

    .song-title {
      font-weight: 600;
      font-size: 15px;
      color: var(--n-text-color-2);
      margin: 0 0 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition: color 0.3s ease, transform 0.2s ease;

      &:hover {
        color: var(--n-text-color);
      }
    }

    .song-artist {
      font-size: 12px;
      color: var(--n-text-color-3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;

      &:hover {
        color: var(--n-text-color-2);
      }
    }
  }

  .song-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover .song-actions {
    opacity: 1;
  }
}

// 播放控制区域
.player-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 50%;
  min-width: 400px;
  gap: 2px;

  .control-buttons {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.ant-btn) {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        transform: scale(1.1);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    :deep(.ant-btn-primary) {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      box-shadow: 0 4px 12px var(--n-primary-color);

      &:hover {
        box-shadow: 0 6px 16px var(--n-primary-color);
        transform: scale(1.15);
      }
    }
  }

  .progress-container {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;

    .time-current,
    .time-total {
      font-size: 12px;
      color: var(--n-text-color-3);
      width: 45px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }

    .progress-slider {
      flex: 1;
      min-width: 200px;

      :deep(.ant-slider-track) {
        background-color: var(--n-primary-color);
      }

      :deep(.ant-slider-btn) {
        width: 14px;
        height: 14px;
        border: 1px solid var(--n-card-color);
        transition: all 0.3s ease;

        &:hover {
          transform: scale(1.05);
        }
      }
    }
  }
}

// 右侧功能区
.player-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 25%;
  min-width: 200px;
  gap: 12px;

  .volume-control {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 120px;

    :deep(.ant-btn) {
      transition: all 0.3s ease;

      &:hover {
        transform: scale(1.1);
      }
    }

    .volume-slider {
      flex: 1;
      min-width: 80px;

      :deep(.ant-slider-btn) {
        width: 12px;
        height: 12px;
        border: 2px solid var(--n-card-color);
      }
    }
  }

  :deep(.ant-btn) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.1);
    }

    &.active {
      color: var(--n-primary-color);
      background: color-mix(in srgb, var(--n-primary-color) 16%, transparent);
    }
  }
}

// 响应式设计
@media (max-width: 1200px) {
  .player-footer {
    .player-container {
      padding: 0 16px;
    }
  }

  .current-song,
  .player-actions {
    width: 20%;
    min-width: 180px;
  }

  .player-controls {
    width: 60%;
  }
}

@media (max-width: 768px) {
  .player-footer {
    height: auto;
    padding: 12px 0;

    .player-container {
      flex-direction: column;
      gap: 12px;
    }
  }

  .current-song,
  .player-controls,
  .player-actions {
    width: 100%;
    min-width: 0;
  }

  .volume-control {
    display: none;
  }
}

// 播放动画
@keyframes playing {
  0%,
  100% {
    transform: scaleY(0.4);
  }
  50% {
    transform: scaleY(1);
  }
}

.playing-animation {
  display: flex;
  gap: 2px;

  span {
    width: 3px;
    height: 14px;
    background: var(--n-primary-color);
    border-radius: 2px;
    animation: playing 0.8s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.2s;
    }

    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

audio {
  display: none;
}
.current-song {
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
  }
}
.progress-container {
  cursor: pointer;
}
</style>
