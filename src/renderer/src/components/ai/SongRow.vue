<template>
  <div class="song-row" :class="{ 'is-manage': showManage }">
    <div v-if="selectable" class="song-check">
      <n-checkbox :checked="checked" @update:checked="onToggle" />
    </div>
    <div v-else-if="showManage" class="song-check placeholder"></div>
    <AppCover :src="song.cover || song.albumCover" :size="64" :width="36" :height="36" :radius="6" />
    <div class="song-meta">
      <div class="song-name">
        <span class="song-name-text">{{ song.name }}</span>
        <n-tag
          v-if="reason"
          size="tiny"
          type="info"
          :bordered="false"
          round
          class="song-reason"
          >✨ {{ reason }}</n-tag
        >
      </div>
      <div class="song-sub">
        {{ song.artist || "未知艺术家" }} · {{ song.album || "未知专辑" }}
      </div>
    </div>
    <div class="song-duration">{{ durationLabel }}</div>
    <div v-if="showManage" class="song-ops">
      <n-button
        text
        size="small"
        :loading="isPreviewLoading"
        class="op-button"
        @click="onPlay"
      >
        <template #icon
          ><n-icon><PauseOutline v-if="isCurrentPlaying" /><PlayOutline v-else /></n-icon
        ></template>
      </n-button>
      <n-button
        v-if="isLoggedIn"
        text
        size="small"
        class="op-button"
        title="收藏"
        @click="onLike"
      >
        <template #icon
          ><n-icon><HeartOutline /></n-icon
        ></template>
      </n-button>
      <n-button text size="small" class="op-button" title="从草稿移除" @click="onRemove">
        <template #icon
          ><n-icon><CloseOutline /></n-icon
        ></template>
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import AppCover from "@/components/common/AppCover.vue";
import { formatDuration } from "@/utils/utils";
import { usePreviewPlayer } from "@/services/ai/previewPlayer";
import {
  PlayOutline,
  PauseOutline,
  HeartOutline,
  CloseOutline,
} from "@vicons/ionicons5";

const props = defineProps({
  song: { type: Object, required: true },
  selectable: { type: Boolean, default: false },
  checked: { type: Boolean, default: false },
  reason: { type: String, default: "" },
  showManage: { type: Boolean, default: false },
  isLoggedIn: { type: Boolean, default: false }
});

const emit = defineEmits(["toggle", "play", "remove", "like"]);

const { playingSongId, isPlaying, loadingSongId } = usePreviewPlayer();

const durationLabel = computed(() => {
  const value = props.song?.duration;
  if (typeof value === "string" && value.includes(":")) return value;
  return formatDuration(Number(props.song?.dt ?? props.song?.durationMs ?? value));
});

const songId = computed(() => String(props.song?.id ?? ""));
const isCurrentPlaying = computed(
  () => playingSongId.value === songId.value && isPlaying.value
);
const isPreviewLoading = computed(() => loadingSongId.value === songId.value);

function onToggle(checked) {
  emit("toggle", props.song.id, checked);
}

function onPlay() {
  emit("play", props.song);
}

function onRemove() {
  emit("remove", props.song);
}

function onLike() {
  emit("like", props.song);
}
</script>

<style scoped lang="scss">
.song-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.18s ease;

  &:hover {
    background-color: var(--n-hover-color);
  }

  &.is-manage {
    cursor: default;
  }
}

.song-check {
  flex-shrink: 0;

  &.placeholder {
    width: 16px;
  }
}

.song-meta {
  flex: 1;
  min-width: 0;
}

.song-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.song-name-text {
  font-size: 13px;
  color: var(--n-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-reason {
  flex-shrink: 0;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-sub {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-duration {
  font-size: 12px;
  color: var(--n-text-color-3);
  flex-shrink: 0;
}

.song-ops {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.op-button {
  color: var(--n-text-color-3);
  transition: color 0.15s ease, transform 0.15s ease;

  &:hover {
    color: var(--primary-color, var(--n-primary-color));
  }
}
</style>
