<template>
  <section class="draft-panel" :class="{ collapsed }">
    <div v-if="collapsed" class="draft-rail">
      <n-button
        size="small"
        quaternary
        circle
        title="展开草稿栏"
        @click="$emit('toggle-collapse')"
      >
        <template #icon
          ><n-icon><ChevronForwardOutline /></n-icon
        ></template>
      </n-button>
      <span class="draft-rail-label">草稿</span>
    </div>

    <template v-else>
      <div class="draft-header">
      <div class="draft-title-row">
        <span class="draft-name">{{ draftName || "AI 草稿歌单" }}</span>
        <n-tag v-if="aiStore.reranking" size="small" type="info" :bordered="false" round>
          精排中…
        </n-tag>
        <n-button
          size="tiny"
          tertiary
          class="draft-collapse"
          circle
          :title="collapsed ? '展开草稿栏' : '收起草稿栏'"
          @click="$emit('toggle-collapse')"
        >
          <template #icon
            ><n-icon><ChevronForwardOutline v-if="collapsed" /><ChevronBackOutline v-else /></n-icon
          ></template>
        </n-button>
      </div>
      <div class="draft-reason" v-if="draftReason">{{ draftReason }}</div>
      <div v-if="rerankReasonLines.length" class="rerank-reasons">
        <div v-for="line in rerankReasonLines" :key="line.id" class="rerank-reason">
          ✨ {{ line.text }}
        </div>
      </div>
      <div class="draft-badges">
        <n-tag size="small" :bordered="false" round>共{{ draftSongs.length }}</n-tag>
        <n-tag v-if="hasPendingDraft" size="small" type="success" :bordered="false" round
          >+{{ pendingDiff.addedSongs.length }}</n-tag
        >
        <n-tag v-if="hasPendingDraft" size="small" type="warning" :bordered="false" round
          >-{{ pendingDiff.removedSongs.length }}</n-tag
        >
      </div>
    </div>

    <div class="draft-toolbar">
      <n-tabs v-model:value="activeTab" type="segment" size="small">
        <n-tab-pane name="draft" :tab="`草稿 (${draftSongs.length})`" />
        <n-tab-pane
          name="diff"
          :tab="`变更 (${pendingDiff.addedSongs.length + pendingDiff.removedSongs.length})`"
          :disabled="!hasPendingDraft"
        />
      </n-tabs>
    </div>

    <div class="draft-actions">
      <n-button size="tiny" tertiary :disabled="!canRollback" @click="onRollback">回滚</n-button>
      <n-button
        size="tiny"
        secondary
        :disabled="!hasPendingDraft"
        @click="onApplyOnlyAdded"
      >
        仅加新歌
      </n-button>
      <n-button
        size="tiny"
        secondary
        :disabled="!hasPendingDraft"
        @click="onApplyPending"
      >
        应用变更
      </n-button>
      <n-button
        size="tiny"
        tertiary
        :loading="aiStore.reranking"
        :disabled="aiStore.loading || draftSongs.length < 10"
        @click="onRerank"
      >
        再精修
      </n-button>
      <n-button
        size="tiny"
        type="primary"
        :loading="aiStore.creating"
        :disabled="!draftSongs.length"
        @click="onConfirm"
      >
        生成歌单
      </n-button>
    </div>

    <div v-if="activeTab === 'diff' && hasPendingDraft" class="diff-toolbar">
      <n-tabs v-model:value="activeDiffTab" type="segment" size="small">
        <n-tab-pane name="added" :tab="`新增 (${pendingDiff.addedSongs.length})`" />
        <n-tab-pane name="removed" :tab="`移除 (${pendingDiff.removedSongs.length})`" />
        <n-tab-pane name="kept" :tab="`保留 (${keptSongs.length})`" />
      </n-tabs>
      <div class="diff-tools">
        <n-input
          v-model:value="songKeyword"
          size="small"
          clearable
          placeholder="筛选歌曲"
          class="song-filter-input"
        />
        <n-button size="tiny" tertiary @click="onSelectAll">全选</n-button>
        <n-button size="tiny" tertiary @click="onClear">清空</n-button>
        <n-button size="tiny" tertiary @click="onInvert">反选</n-button>
      </div>
    </div>

    <div class="draft-body">
      <n-scrollbar class="draft-scroll">
        <template v-if="activeTab === 'diff' && hasPendingDraft">
          <div v-if="aiStore.loading" class="diff-skeleton">
            <n-skeleton text :repeat="4" />
            <div class="skeleton-tip">正在计算本轮变更，请稍候...</div>
          </div>
          <div v-else-if="!currentTabSongs.length" class="draft-empty">
            <n-empty description="当前分组没有可展示的歌曲" />
          </div>
          <div v-else class="song-list">
            <SongRow
              v-for="song in currentTabSongs"
              :key="song.id"
              :song="song"
              selectable
              :checked="isSongSelected(song.id)"
              @toggle="onToggleSong"
            />
          </div>
        </template>

        <template v-else>
          <div v-if="aiStore.loading && !draftSongs.length" class="diff-skeleton">
            <n-skeleton text :repeat="4" />
            <div class="skeleton-tip">正在生成歌单，请稍候...</div>
          </div>
          <div v-else-if="!draftSongs.length" class="draft-empty">
            <n-empty description="还没有草稿，先在对话里描述你想听的音乐" />
          </div>
          <div v-else class="song-list">
            <SongRow
              v-for="song in draftSongs"
              :key="song.id"
              :song="song"
              show-manage
              :is-logged-in="isLoggedIn"
              :reason="reasonMap[String(song.id)]"
              @play="onPreview"
              @remove="onRemoveSong"
              @like="onLikeSong"
            />
          </div>
        </template>
      </n-scrollbar>
    </div>

    <div v-if="hasPendingDraft" class="draft-footer">
      <span class="action-subtitle">
        预计最终 {{ estimatedFinalCount }} 首（新增 {{ selectionSummary.added }} /
        移除 {{ selectionSummary.removed }}）
      </span>
    </div>
      </template>
  </section>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui";
import { useAiPlaylistStore } from "@/stores/aiPlaylistStore";
import { usePlaylistStore } from "@/stores/playlistStore";
import { useUserStore } from "@/stores/userStore";
import SongRow from "@/components/ai/SongRow.vue";
import { togglePreview } from "@/services/ai/previewPlayer";
import { ChevronBackOutline, ChevronForwardOutline } from "@vicons/ionicons5";

defineProps({
  collapsed: { type: Boolean, default: false }
});

defineEmits(["toggle-collapse"]);
const message = useMessage();
const aiStore = useAiPlaylistStore();
const playlistStore = usePlaylistStore();
const userStore = useUserStore();

const activeTab = ref("draft");
const activeDiffTab = ref("added");
const songKeyword = ref("");

const draftSongs = computed(() => aiStore.draftPlaylist?.songs || []);
const draftName = computed(() => aiStore.draftPlaylist?.name || "");
const draftReason = computed(() => aiStore.draftPlaylist?.reason || "");
const hasPendingDraft = computed(() => Boolean(aiStore.pendingDraftPlaylist));
const canRollback = computed(() => Boolean(aiStore.lastCommittedDraft));
const pendingDiff = computed(
  () => aiStore.pendingDraftDiff || { addedSongs: [], removedSongs: [] }
);
const isLoggedIn = computed(() => userStore.isLoggedIn);

const addedSelection = computed(() => aiStore.pendingDraftSelection?.addedSongIds || []);
const removedSelection = computed(() => aiStore.pendingDraftSelection?.removedSongIds || []);

const keptSongs = computed(() => {
  const currentSongs = aiStore.draftPlaylist?.songs || [];
  const removedSet = new Set(
    (pendingDiff.value.removedSongs || []).map((song) => Number(song.id))
  );
  return currentSongs.filter((song) => !removedSet.has(Number(song.id)));
});

const currentTabSongs = computed(() => {
  const keyword = String(songKeyword.value || "")
    .trim()
    .toLowerCase();
  const baseList =
    activeDiffTab.value === "added"
      ? pendingDiff.value.addedSongs || []
      : activeDiffTab.value === "removed"
        ? pendingDiff.value.removedSongs || []
        : keptSongs.value || [];

  if (!keyword) return baseList;
  return baseList.filter((song) => {
    const text = `${song?.name || ""} ${song?.artist || ""} ${
      song?.album || ""
    }`.toLowerCase();
    return text.includes(keyword);
  });
});

const selectionSummary = computed(() => ({
  added: addedSelection.value.length,
  removed: aiStore.pendingApplyMode === "only_add" ? 0 : removedSelection.value.length
}));

const estimatedFinalCount = computed(() => {
  const base = aiStore.draftPlaylist?.songs?.length || 0;
  return Math.max(0, base + selectionSummary.value.added - selectionSummary.value.removed);
});

const reasonMap = computed(() => {
  const map = {};
  for (const item of aiStore.rerankHighlights || []) {
    map[String(item.id)] = item.reason;
  }
  return map;
});

const rerankReasonLines = computed(() => {
  const songs = draftSongs.value || [];
  return (aiStore.rerankHighlights || []).map((item) => {
    const song = songs.find((candidate) => String(candidate.id) === String(item.id));
    return {
      id: item.id,
      text: song ? `${song.name}：${item.reason}` : item.reason
    };
  });
});

function isSongSelected(songId) {
  const id = Number(songId);
  if (!id) return false;
  if (activeDiffTab.value === "added") return addedSelection.value.includes(id);
  if (activeDiffTab.value === "removed") return removedSelection.value.includes(id);
  return false;
}

function onToggleSong(songId, checked) {
  if (!checked && !isSongSelected(songId)) return;
  if (checked && isSongSelected(songId)) return;
  if (activeDiffTab.value === "added") {
    aiStore.togglePendingAddedSong(songId);
  } else if (activeDiffTab.value === "removed") {
    aiStore.togglePendingRemovedSong(songId);
  }
}

function onSelectAll() {
  if (activeDiffTab.value === "added") aiStore.selectAllPendingAddedSongs();
  else if (activeDiffTab.value === "removed") aiStore.selectAllPendingRemovedSongs();
}

function onClear() {
  if (activeDiffTab.value === "added") aiStore.clearPendingAddedSongs();
  else if (activeDiffTab.value === "removed") aiStore.clearPendingRemovedSongs();
}

function onInvert() {
  const list = currentTabSongs.value || [];
  if (activeDiffTab.value === "added") {
    for (const song of list) aiStore.togglePendingAddedSong(song.id);
  } else if (activeDiffTab.value === "removed") {
    for (const song of list) aiStore.togglePendingRemovedSong(song.id);
  }
}

function onApplyPending() {
  aiStore.setPendingApplyMode("standard");
  const ok = aiStore.applyPendingDraft();
  if (ok) message.success("已应用调整");
  activeTab.value = "draft";
}

function onApplyOnlyAdded() {
  aiStore.setPendingApplyMode("only_add");
  const ok = aiStore.applyPendingDraft();
  if (ok) message.success("已仅应用新增歌曲");
  activeTab.value = "draft";
}

function onRollback() {
  const ok = aiStore.rollbackDraft();
  if (ok) message.warning("已回滚");
}

async function onRerank() {
  const result = await aiStore.rerankDraft();
  if (!result?.success) {
    message.info(result?.error || "当前候选数量不足，暂无法精排");
  }
}

async function onConfirm() {
  const result = await aiStore.createDraftToLocalPlaylist();
  if (result?.success) {
    message.success(`已创建歌单，添加 ${result.addedSongs || 0} 首`);
  } else {
    message.error(result?.error || aiStore.error || "创建失败");
  }
}

function onPreview(song) {
  togglePreview(song);
}

function onRemoveSong(song) {
  const ok = aiStore.removeSongFromDraft(song.id);
  if (ok) message.success(`已从草稿移除「${song.name || ""}」，后续推荐会自动排除`);
}

async function onLikeSong(song) {
  if (!userStore.isLoggedIn) {
    message.warning("请先登录后再操作");
    return;
  }
  try {
    const success = await playlistStore.toggleLikeSong(song.id, true);
    if (success) message.success(`已收藏「${song.name || ""}」`);
    else message.error("收藏失败，请重试");
  } catch {
    message.error("收藏失败，请重试");
  }
}
</script>

<style scoped lang="scss">
.draft-panel {
  width: 340px;
  flex-shrink: 0;
  border-left: 1px solid var(--n-border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: width 0.2s ease;

  &.collapsed {
    width: 48px;
  }
}

.draft-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
}

.draft-rail-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  writing-mode: vertical-lr;
}

.draft-header {
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--n-border-color);
}

.draft-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.draft-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-collapse {
  flex-shrink: 0;
}

.draft-reason {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
  line-height: 1.5;
}

.rerank-reasons {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 6px;
}

.rerank-reason {
  font-size: 12px;
  line-height: 1.5;
  color: var(--primary-color, var(--n-primary-color));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.draft-toolbar {
  padding: 8px 12px 0;
}

.draft-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.diff-toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.diff-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.song-filter-input {
  flex: 1;
}

.draft-body {
  flex: 1;
  min-height: 0;
}

.draft-scroll {
  height: 100%;
}

.song-list {
  padding: 6px 8px 12px;
}

.draft-empty {
  padding: 32px 0;
}

.diff-skeleton {
  padding: 16px;
}

.skeleton-tip {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 8px;
}

.draft-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--n-border-color);
}

.action-subtitle {
  font-size: 12px;
  color: var(--n-text-color-3);
}
</style>
