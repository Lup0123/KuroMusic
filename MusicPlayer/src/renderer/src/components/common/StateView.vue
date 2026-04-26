<template>
  <div class="state-view">
    <div v-if="loading" class="state-block state-loading">
      <slot name="loading">
        <n-spin size="large" />
        <p class="state-text">{{ loadingText }}</p>
      </slot>
    </div>

    <div v-else-if="error" class="state-block state-error">
      <slot name="error">
        <n-empty :description="errorText" />
        <n-button v-if="showRetry" size="small" tertiary @click="$emit('retry')">重试</n-button>
      </slot>
    </div>

    <div v-else-if="empty" class="state-block state-empty">
      <slot name="empty">
        <n-empty :description="emptyText" />
      </slot>
    </div>

    <slot v-else />
  </div>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  empty: {
    type: Boolean,
    default: false
  },
  error: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: '加载中...'
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  errorText: {
    type: String,
    default: '加载失败，请稍后重试'
  },
  showRetry: {
    type: Boolean,
    default: false
  }
})

defineEmits(['retry'])
</script>

<style scoped lang="scss">
.state-view {
  width: 100%;
  height: 100%;
}

.state-block {
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.state-text {
  margin: 0;
  font-size: 13px;
  color: var(--n-text-color-3);
}
</style>
