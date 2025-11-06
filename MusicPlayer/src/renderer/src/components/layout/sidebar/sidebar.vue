<template>
  <el-aside width="240px" class="sidebar">
    <el-menu :default-active="cur_index" class="sidebar-menu">
      <el-menu-item index="mainpage" @click="setCurIndex('mainpage')">
        <el-icon><House /></el-icon>
        <span>发现</span>
      </el-menu-item>
      <el-menu-item index="my-music" @click="setCurIndex('my-music')">
        <el-icon><Headset /></el-icon>
        <span>我的音乐</span>
      </el-menu-item>
      <el-menu-item
        index="recently-played"
        @click="setCurIndex('recently-played')">
        <el-icon><Clock /></el-icon>
        <span>最近播放</span>
      </el-menu-item>

      <el-divider />

      <el-sub-menu index="5">
        <template #title>
          <el-icon><Folder /></el-icon>
          <span>我的歌单</span>
        </template>
        <el-menu-item index="5-1">流行音乐</el-menu-item>
        <el-menu-item index="5-2">摇滚经典</el-menu-item>
        <el-menu-item index="5-3">轻音乐</el-menu-item>
      </el-sub-menu>
    </el-menu>
  </el-aside>
</template>

<script setup>
import { useIndexStore } from '@/stores/indexStore'
import { storeToRefs } from 'pinia'

const indexStore = useIndexStore()
const { setCurIndex } = indexStore
const { cur_index } = storeToRefs(indexStore)
</script>

<style scoped>
@import './sidebar.css';
</style>
