<template>
  <div class="my-playlist">
    <!-- 头部 -->
    <div class="playlist-header">
      <el-page-header @back="goBack" title="返回">
        <template #content>
          <span class="header-title">我的歌单</span>
        </template>
        <template #extra>
          <el-button type="primary" :icon="Plus" @click="createPlaylist"> 创建歌单 </el-button>
        </template>
      </el-page-header>
    </div>

    <!-- 歌单列表 -->
    <div class="playlist-content">
      <el-empty v-if="playlists.length === 0" description="暂无歌单">
        <el-button type="primary" @click="createPlaylist">立即创建</el-button>
      </el-empty>

      <el-row v-else :gutter="20" class="playlist-grid">
        <el-col
          v-for="playlist in playlists"
          :key="playlist.id"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
          :xl="4"
        >
          <el-card class="playlist-card" shadow="hover" @click="openPlaylist(playlist)">
            <template #header>
              <div class="card-header">
                <el-avatar :size="120" :src="playlist.cover" shape="square">
                  <el-icon :size="40"><Headset /></el-icon>
                </el-avatar>
                <div class="song-count">
                  <el-icon><List /></el-icon>
                  <span>{{ playlist.songCount }}</span>
                </div>
              </div>
            </template>

            <div class="playlist-info">
              <div class="playlist-name">{{ playlist.name }}</div>
              <div class="playlist-desc">{{ playlist.description || '暂无描述' }}</div>
            </div>

            <template #footer>
              <div class="card-footer">
                <el-button text @click.stop="editPlaylist(playlist)">
                  <el-icon><Edit /></el-icon>
                  编辑
                </el-button>
                <el-button text type="danger" @click.stop="deletePlaylist(playlist)">
                  <el-icon><Delete /></el-icon>
                  删除
                </el-button>
              </div>
            </template>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 创建/编辑歌单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑歌单' : '创建歌单'"
      width="500px"
      @close="resetForm"
    >
      <el-form :model="playlistForm" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="歌单名称" prop="name">
          <el-input
            v-model="playlistForm.name"
            placeholder="请输入歌单名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="歌单描述" prop="description">
          <el-input
            v-model="playlistForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入歌单描述"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="封面图片">
          <el-upload
            class="cover-uploader"
            :show-file-list="false"
            :before-upload="beforeUpload"
            :http-request="handleUpload"
          >
            <el-image
              v-if="playlistForm.cover"
              :src="playlistForm.cover"
              fit="cover"
              class="cover-preview"
            />
            <el-icon v-else class="cover-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Headset, List } from '@element-plus/icons-vue'

const router = useRouter()
const formRef = ref(null)
const dialogVisible = ref(false)
const isEdit = ref(false)

// 歌单列表
const playlists = ref([
  {
    id: '1',
    name: '我喜欢的音乐',
    description: '收藏的歌曲',
    cover: 'https://via.placeholder.com/200',
    songCount: 128,
    createTime: '2024-01-01'
  },
  {
    id: '2',
    name: '华语流行',
    description: '最新华语流行音乐',
    cover: 'https://via.placeholder.com/200',
    songCount: 56,
    createTime: '2024-01-02'
  },
  {
    id: '3',
    name: '欧美经典',
    description: '经典欧美歌曲合集',
    cover: 'https://via.placeholder.com/200',
    songCount: 89,
    createTime: '2024-01-03'
  }
])

// 表单数据
const playlistForm = reactive({
  id: '',
  name: '',
  description: '',
  cover: ''
})

// 表单验证规则
const rules = {
  name: [
    { required: true, message: '请输入歌单名称', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}

// 返回上一页
const goBack = () => {
  router.back()
}

// 创建歌单
const createPlaylist = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

// 编辑歌单
const editPlaylist = (playlist) => {
  isEdit.value = true
  playlistForm.id = playlist.id
  playlistForm.name = playlist.name
  playlistForm.description = playlist.description
  playlistForm.cover = playlist.cover
  dialogVisible.value = true
}

// 删除歌单
const deletePlaylist = (playlist) => {
  ElMessageBox.confirm(`确定要删除歌单 "${playlist.name}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      const index = playlists.value.findIndex((item) => item.id === playlist.id)
      if (index !== -1) {
        playlists.value.splice(index, 1)
        ElMessage.success('删除成功')
      }
    })
    .catch(() => {
      ElMessage.info('已取消删除')
    })
}

// 打开歌单详情
const openPlaylist = (playlist) => {
  ElMessage.info(`打开歌单: ${playlist.name}`)
  // router.push({ name: 'PlaylistDetail', params: { id: playlist.id } })
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      if (isEdit.value) {
        // 编辑
        const index = playlists.value.findIndex((item) => item.id === playlistForm.id)
        if (index !== -1) {
          playlists.value[index] = {
            ...playlists.value[index],
            name: playlistForm.name,
            description: playlistForm.description,
            cover: playlistForm.cover
          }
          ElMessage.success('修改成功')
        }
      } else {
        // 新建
        const newPlaylist = {
          id: Date.now().toString(),
          name: playlistForm.name,
          description: playlistForm.description,
          cover: playlistForm.cover || 'https://via.placeholder.com/200',
          songCount: 0,
          createTime: new Date().toLocaleDateString()
        }
        playlists.value.unshift(newPlaylist)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
    }
  })
}

// 重置表单
const resetForm = () => {
  playlistForm.id = ''
  playlistForm.name = ''
  playlistForm.description = ''
  playlistForm.cover = ''
  formRef.value?.resetFields()
}

// 上传前验证
const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }
  return true
}

// 自定义上传
const handleUpload = (options) => {
  const { file } = options
  const reader = new FileReader()

  reader.onload = (e) => {
    playlistForm.cover = e.target.result
  }

  reader.readAsDataURL(file)
}

onMounted(() => {
  console.log('歌单页面已加载')
})
</script>

<style lang="scss" scoped>
@import './Myplaylist.scss';
</style>
