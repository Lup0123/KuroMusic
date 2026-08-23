<template>
  <div class="guide-cards">
    <div
      v-for="scene in scenes"
      :key="scene.key"
      class="guide-card"
      tabindex="0"
      @click="onPick(scene)"
      @keydown.enter="onPick(scene)"
    >
      <span class="guide-card-icon">{{ scene.icon }}</span>
      <div class="guide-card-body">
        <div class="guide-card-title">{{ scene.title }}</div>
        <div class="guide-card-desc">{{ scene.prompt }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const scenes = [
  { key: "run", icon: "🏃", title: "夜跑", prompt: "夜跑动感一点，节奏强的歌" },
  { key: "study", icon: "📖", title: "学习", prompt: "适合专注学习的轻音乐" },
  { key: "sleep", icon: "🌙", title: "睡前", prompt: "睡前放松的安静歌曲" },
  { key: "commute", icon: "🚇", title: "通勤", prompt: "通勤路上听的歌" },
  { key: "heal", icon: "☀️", title: "治愈", prompt: "治愈温暖的歌曲" },
  { key: "burn", icon: "🔥", title: "燃", prompt: "热血燃向的歌" }
];

const emit = defineEmits(["pick"]);

function onPick(scene) {
  emit("pick", scene.prompt);
}
</script>

<style scoped lang="scss">
.guide-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding: 16px;
}

.guide-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  cursor: pointer;
  outline: none;
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--primary-color, var(--n-primary-color));
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
  }
}

.guide-card-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.guide-card-body {
  min-width: 0;
}

.guide-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color);
}

.guide-card-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
