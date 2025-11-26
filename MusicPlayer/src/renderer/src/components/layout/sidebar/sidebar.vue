<template>
  <a-layout-sider width="240px" class="sidebar">
    <a-menu
      :selected-keys="[cur_index]"
      class="sidebar-menu"
      @menu-item-click="handleMenuClick"
    >
      <a-menu-item key="mainpage">
        <template #icon>
          <icon-home />
        </template>
        发现
      </a-menu-item>
      <a-menu-item key="my-music">
        <template #icon>
          <icon-music />
        </template>
        我的音乐
      </a-menu-item>

      <a-divider />

      <a-sub-menu key="5">
        <template #icon>
          <icon-folder />
        </template>
        <template #title>我的歌单</template>
        <a-menu-item key="5-1">流行音乐</a-menu-item>
        <a-menu-item key="5-2">摇滚经典</a-menu-item>
        <a-menu-item key="5-3">轻音乐</a-menu-item>
      </a-sub-menu>
    </a-menu>
  </a-layout-sider>
</template>

<script setup>
import { useIndexStore } from "@/stores/indexStore";
import { storeToRefs } from "pinia";
import { IconHome, IconMusic, IconFolder } from "@arco-design/web-vue/es/icon";

const indexStore = useIndexStore();
const { setCurIndex } = indexStore;
const { cur_index } = storeToRefs(indexStore);

const handleMenuClick = (key) => {
  setCurIndex(key);
};
</script>

<style scoped>
@import "./sidebar.css";
</style>
