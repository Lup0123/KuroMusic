<template>
  <n-modal
    v-model:show="aiPlaylistStore.visible"
    class="ai-chat-modal"
    :class="{ 'ai-window-mode': isAiWindow }"
    content-scrollable
    preset="card"
    size="huge"
    :bordered="false"
    :style="modalStyle"
    :header-style="headerStyle"
    :body-style="{ padding: 0 }"
    :footer-style="{ padding: 0, borderTop: 'none' }"
    :mask-closable="!isAiWindow"
    :closable="!isAiWindow"
    @close="onModalClose"
  >
    <template #header>
      <div class="chat-header" @dblclick="onHeaderDblClick">
        <div class="header-title">
          <n-icon class="header-logo"><SparklesOutline /></n-icon>
          AI 助手
        </div>
        <div class="header-actions">
          <n-radio-group
            size="small"
            :value="aiStore.chatMode"
            @update:value="onChatModeChange"
          >
            <n-radio-button value="chat">对话讨论</n-radio-button>
            <n-radio-button value="recommend">直接推荐</n-radio-button>
          </n-radio-group>
          <n-dropdown
            trigger="click"
            :options="recentPromptOptions"
            :disabled="recentPromptOptions.length === 0"
            @select="onSelectRecentPrompt"
          >
            <n-button size="small" quaternary circle title="最近输入">
              <template #icon
                ><n-icon><TimeOutline /></n-icon
              ></template>
            </n-button>
          </n-dropdown>
          <template v-if="isAiWindow">
            <n-button size="small" quaternary circle @click="onAiWindowMinimize">
              <template #icon
                ><n-icon><RemoveOutline /></n-icon
              ></template>
            </n-button>
            <n-button size="small" quaternary circle @click="onAiWindowMaximize">
              <template #icon
                ><n-icon
                  ><component
                    :is="isAiWindowMaximized ? ContractOutline : CropOutline" /></n-icon
              ></template>
            </n-button>
            <n-button size="small" quaternary circle @click="onAiWindowClose">
              <template #icon
                ><n-icon><CloseOutline /></n-icon
              ></template>
            </n-button>
          </template>
        </div>
      </div>
    </template>

    <div class="result-layout">
      <SessionSidebar
        :collapsed="!showSession"
        @toggle-collapse="toggleSessionCollapse"
      />
      <ConversationPanel class="conversation-column" />
      <DraftPanel :collapsed="!showDraft" @toggle-collapse="toggleDraftCollapse" />
    </div>
  </n-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, reactive } from "vue";
import { useDialog } from "naive-ui";
import { useAiPlaylistStore } from "@/stores/aiPlaylistStore";
import SessionSidebar from "@/components/ai/SessionSidebar.vue";
import ConversationPanel from "@/components/ai/ConversationPanel.vue";
import DraftPanel from "@/components/ai/DraftPanel.vue";
import { stopPreview } from "@/services/ai/previewPlayer";
import {
  SparklesOutline,
  TimeOutline,
  RemoveOutline,
  CropOutline,
  CloseOutline,
  ContractOutline
} from "@vicons/ionicons5";

const UI_PREFS_KEY = "ai-ui-prefs";
const SESSION_AUTO_HIDE_WIDTH = 1000;
const DRAFT_AUTO_HIDE_WIDTH = 1180;

const aiPlaylistStore = useAiPlaylistStore();
const aiStore = aiPlaylistStore;
const dialog = useDialog();

const isAiWindow = ref(false);
const isAiWindowMaximized = ref(false);
const windowWidth = ref(window.innerWidth || 1280);
const uiPrefs = reactive(loadUiPrefs());
let removeWindowMaximizedListener = null;

function loadUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sessionCollapsed: Boolean(parsed?.sessionCollapsed),
        draftCollapsed: Boolean(parsed?.draftCollapsed)
      };
    }
  } catch {
    // ignore
  }
  return { sessionCollapsed: false, draftCollapsed: false };
}

function persistUiPrefs() {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(uiPrefs));
  } catch {
    // ignore
  }
}

const showSession = computed(
  () => !(uiPrefs.sessionCollapsed || windowWidth.value < SESSION_AUTO_HIDE_WIDTH)
);
const showDraft = computed(
  () => !(uiPrefs.draftCollapsed || windowWidth.value < DRAFT_AUTO_HIDE_WIDTH)
);

const modalStyle = computed(() =>
  isAiWindow.value
    ? {
        width: "100vw",
        height: "100vh",
        maxWidth: "100vw",
        maxHeight: "100vh",
        top: "0",
        margin: 0,
        borderRadius: 0
      }
    : { width: "min(1280px, calc(100vw - 24px))" }
);

const headerStyle = computed(() => ({
  padding: "12px 16px 10px",
  borderBottom: "1px solid var(--n-border-color)"
}));

const recentPromptOptions = computed(() =>
  (aiStore.recentPrompts || []).map((prompt, index) => ({
    label: prompt,
    key: String(index)
  }))
);

function onChatModeChange(value) {
  aiStore.setChatMode(value);
}

async function onSelectRecentPrompt(key) {
  const index = Number(key);
  if (!Number.isInteger(index)) return;
  await aiStore.reusePromptByIndex(index);
}

function toggleSessionCollapse() {
  uiPrefs.sessionCollapsed = !showSession.value;
  persistUiPrefs();
}

function toggleDraftCollapse() {
  uiPrefs.draftCollapsed = !showDraft.value;
  persistUiPrefs();
}

function onModalClose() {
  if (isAiWindow.value) {
    globalThis?.window?.api?.aiWindowClose?.();
    return;
  }
  aiPlaylistStore.closeModal();
}

function onAiWindowMinimize() {
  if (globalThis?.window?.api?.aiWindowMinimize) {
    globalThis.window.api.aiWindowMinimize();
    return;
  }
  globalThis?.window?.api?.minimize?.();
}

function onAiWindowMaximize() {
  if (globalThis?.window?.api?.aiWindowMaximize) {
    globalThis.window.api.aiWindowMaximize();
    return;
  }
  globalThis?.window?.api?.maximize?.();
}

function onHeaderDblClick() {
  if (!isAiWindow.value) return;
  onAiWindowMaximize();
}

function onAiWindowClose() {
  if (globalThis?.window?.api?.aiWindowClose) {
    globalThis.window.api.aiWindowClose();
    return;
  }
  globalThis?.window?.api?.close?.();
}

function onWindowResize() {
  windowWidth.value = window.innerWidth || 1280;
}

function onAiWindowKeydown(event) {
  if (!isAiWindow.value) return;
  if (event.key === "Escape") {
    event.preventDefault();
    onAiWindowClose();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
    event.preventDefault();
    onAiWindowClose();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "m") {
    event.preventDefault();
    onAiWindowMinimize();
  }
}

function showBehaviorNotice() {
  globalThis?.window?.api
    ?.behaviorGetConfig?.()
    .then((config) => {
      if (!config?.enabled || config?.promptShown) return;
      dialog.info({
        title: "开启 AI 偏好记忆",
        content:
          "将记录你播放、收藏、跳过等行为用于优化 AI 推荐，数据仅保存在本地，可随时在设置中关闭。",
        positiveText: "知道了",
        negativeText: "关闭",
        onPositiveClick: () => {
          globalThis?.window?.api?.behaviorMarkPromptShown?.();
        },
        onNegativeClick: () => {
          globalThis?.window?.api?.behaviorMarkPromptShown?.();
          globalThis?.window?.api?.behaviorSetEnabled?.(false);
        }
      });
    })
    .catch(() => {});
}

aiStore.initializeStore();

watch(
  () => aiPlaylistStore.visible,
  (showing) => {
    if (!showing) {
      stopPreview();
      if (typeof removeWindowMaximizedListener === "function") {
        removeWindowMaximizedListener();
        removeWindowMaximizedListener = null;
      }
    }
  }
);

onMounted(() => {
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("keydown", onAiWindowKeydown);
  showBehaviorNotice();

  globalThis?.window?.api
    ?.getWindowRole?.()
    .then((role) => {
      isAiWindow.value = role === "ai";
      if (isAiWindow.value) {
        globalThis?.window?.api
          ?.getAiWindowMaximized?.()
          .then((value) => {
            isAiWindowMaximized.value = Boolean(value);
          })
          .catch(() => {
            isAiWindowMaximized.value = false;
          });

        removeWindowMaximizedListener = globalThis?.window?.api?.onAiWindowMaximizedChanged?.(
          (value) => {
            isAiWindowMaximized.value = Boolean(value);
          }
        );
      }
    })
    .catch(() => {
      isAiWindow.value = false;
    });
});

onBeforeUnmount(() => {
  stopPreview();
  window.removeEventListener("resize", onWindowResize);
  window.removeEventListener("keydown", onAiWindowKeydown);
  if (typeof removeWindowMaximizedListener === "function") {
    removeWindowMaximizedListener();
    removeWindowMaximizedListener = null;
  }
});
</script>

<style scoped lang="scss">
.ai-chat-modal {
  overflow: hidden;
  height: 100%;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
  z-index: auto;
}

:deep(.ai-chat-modal .n-card) {
  height: 100%;
  top: 0;
}

:deep(.ai-chat-modal .n-card-header .header-actions),
:deep(.ai-chat-modal .n-card-header .n-radio-group),
:deep(.ai-chat-modal .n-card-header .n-dropdown),
:deep(.ai-chat-modal .n-card-header .n-button) {
  -webkit-app-region: no-drag;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  -webkit-app-region: no-drag;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--n-text-color);
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: drag;
  user-select: none;
}

.header-logo {
  color: var(--primary-color, var(--n-primary-color));
  font-size: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-layout {
  display: flex;
  height: 100%;
  min-height: 0;
}

.conversation-column {
  flex: 1;
  min-width: 0;
}
</style>
