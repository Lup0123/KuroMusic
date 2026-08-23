<template>
  <aside class="session-sidebar" :class="{ collapsed }">
    <div class="session-sidebar-header">
      <div v-if="!collapsed" class="sidebar-title">历史会话</div>
      <n-button v-if="!collapsed" size="tiny" tertiary @click="onCreate">
        <template #icon
          ><n-icon><AddOutline /></n-icon
        ></template>
        新建
      </n-button>
      <n-button size="tiny" quaternary circle :title="collapsed ? '展开会话栏' : '收起会话栏'" @click="onToggleCollapse">
        <template #icon
          ><n-icon><ChevronBackOutline v-if="!collapsed" /><ChevronForwardOutline v-else /></n-icon
        ></template>
      </n-button>
    </div>
    <n-scrollbar v-if="!collapsed" class="session-scrollbar">
      <div class="session-list">
        <div
          v-for="session in aiStore.sessions"
          :key="session.id"
          class="session-item"
          :class="{ 'is-active': session.id === aiStore.currentSessionId }"
          @click="onSwitch(session.id)"
        >
          <div class="session-main">
            <div class="session-name">{{ session.title }}</div>
            <div class="session-preview">{{ getSessionPreview(session) }}</div>
          </div>
          <n-button
            text
            size="tiny"
            class="session-delete"
            :disabled="aiStore.sessions.length <= 1"
            @click.stop="onDelete(session.id)"
          >
            <template #icon
              ><n-icon><TrashOutline /></n-icon
            ></template>
          </n-button>
        </div>
      </div>
    </n-scrollbar>
  </aside>
</template>

<script setup>
import { useMessage } from "naive-ui";
import { useAiPlaylistStore } from "@/stores/aiPlaylistStore";
import {
  AddOutline,
  TrashOutline,
  ChevronBackOutline,
  ChevronForwardOutline
} from "@vicons/ionicons5";

defineProps({
  collapsed: { type: Boolean, default: false }
});

const emit = defineEmits(["toggle-collapse"]);
const message = useMessage();
const aiStore = useAiPlaylistStore();

function getSessionPreview(session) {
  const list = Array.isArray(session?.chatMessages) ? session.chatMessages : [];
  const latest = list[list.length - 1]?.content || "";
  return String(latest || "暂无对话内容").slice(0, 36);
}

function onCreate() {
  aiStore.createSession("");
}

function onDelete(sessionId) {
  if (aiStore.sessions.length <= 1) {
    message.warning("至少保留一个会话");
    return;
  }
  const removed = aiStore.deleteSession(sessionId);
  if (removed) message.success("已删除会话");
}

function onSwitch(sessionId) {
  aiStore.switchSession(sessionId);
}

function onToggleCollapse() {
  emit("toggle-collapse");
}
</script>

<style scoped lang="scss">
.session-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--n-border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
  transition: width 0.2s ease;

  &.collapsed {
    width: 48px;
  }
}

.session-sidebar-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 10px 8px;
}

.sidebar-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color);
  overflow: hidden;
  white-space: nowrap;
}

.session-scrollbar {
  flex: 1;
  min-height: 0;
}

.session-list {
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: var(--n-hover-color);
  }

  &.is-active {
    background-color: color-mix(
      in srgb,
      var(--primary-color, var(--n-primary-color)) 12%,
      transparent
    );
  }
}

.session-main {
  flex: 1;
  min-width: 0;
}

.session-name {
  font-size: 13px;
  color: var(--n-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-preview {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-delete {
  flex-shrink: 0;
}
</style>
