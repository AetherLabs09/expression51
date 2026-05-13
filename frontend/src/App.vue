<template>
  <div class="emoji-manager">
    <el-container>
      <el-header>
        <h1>用户表情管理系统</h1>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索表情..."
          class="search-input"
          @input="handleSearch"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </el-header>

      <el-container>
        <el-aside width="200px">
          <el-menu
            :default-active="activeCategory"
            @select="handleCategorySelect"
          >
            <el-menu-item index="all">
              <el-icon><Grid /></el-icon>
              <span>全部表情</span>
            </el-menu-item>
            <el-menu-item index="default">
              <el-icon><Picture /></el-icon>
              <span>系统默认</span>
            </el-menu-item>
            <el-menu-item index="hot">
              <el-icon><Star /></el-icon>
              <span>热门表情</span>
            </el-menu-item>
            <el-menu-item index="animated">
              <el-icon><VideoPlay /></el-icon>
              <span>动态表情</span>
            </el-menu-item>
            <el-menu-item index="pack">
              <el-icon><FolderOpened /></el-icon>
              <span>表情包合集</span>
            </el-menu-item>
            <el-menu-item index="custom">
              <el-icon><Plus /></el-icon>
              <span>自定义表情</span>
            </el-menu-item>
            <el-divider />
            <el-menu-item index="favorites">
              <el-icon><Collection /></el-icon>
              <span>我的收藏</span>
            </el-menu-item>
            <el-menu-item index="recent">
              <el-icon><Clock /></el-icon>
              <span>最近使用</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <el-main>
          <div class="toolbar" v-if="activeCategory !== 'favorites' && activeCategory !== 'recent'">
            <el-upload
              :action="uploadUrl"
              :show-file-list="false"
              :on-success="handleUploadSuccess"
              :before-upload="beforeUpload"
              accept="image/*"
            >
              <el-button type="primary">
                <el-icon><Upload /></el-icon>
                上传自定义表情
              </el-button>
            </el-upload>
          </div>

          <div class="toolbar" v-if="activeCategory === 'favorites'">
            <el-button type="primary" @click="toggleManageMode">
              <el-icon><Setting /></el-icon>
              {{ manageMode ? '完成管理' : '管理收藏' }}
            </el-button>
            <el-button v-if="manageMode" type="danger" @click="batchDeleteFavorites">
              <el-icon><Delete /></el-icon>
              删除选中
            </el-button>
          </div>

          <div class="emoji-grid" v-loading="loading">
            <div
              v-for="emoji in emojis"
              :key="emoji.id"
              class="emoji-item"
              :class="{ selected: manageMode && selectedEmojis.includes(emoji.id) }"
              @click="handleEmojiClick(emoji)"
            >
              <img :src="getEmojiUrl(emoji.url)" :alt="emoji.name" />
              <div class="emoji-name">{{ emoji.name }}</div>
              <div class="emoji-actions" v-if="!manageMode">
                <el-button
                  size="small"
                  circle
                  :type="isFavorite(emoji.id) ? 'warning' : 'default'"
                  @click.stop="toggleFavorite(emoji)"
                >
                  <el-icon><Star /></el-icon>
                </el-button>
                <el-button
                  v-if="emoji.is_custom"
                  size="small"
                  circle
                  type="danger"
                  @click.stop="deleteEmoji(emoji)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
              <el-checkbox
                v-if="manageMode"
                :model-value="selectedEmojis.includes(emoji.id)"
                @change="toggleSelect(emoji.id)"
                class="select-checkbox"
              />
            </div>
          </div>

          <div class="pagination" v-if="total > pageSize && !isSpecialCategory">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              layout="prev, pager, next"
              @current-change="handlePageChange"
            />
          </div>
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const API_BASE = '/api'
const uploadUrl = `${API_BASE}/emojis/upload`

const emojis = ref([])
const favorites = ref([])
const recentUsed = ref([])
const loading = ref(false)
const searchKeyword = ref('')
const activeCategory = ref('all')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const manageMode = ref(false)
const selectedEmojis = ref([])

const isSpecialCategory = computed(() => {
  return activeCategory.value === 'favorites' || activeCategory.value === 'recent'
})

const getEmojiUrl = (url) => {
  if (url.startsWith('http')) return url
  return url.startsWith('/') ? url : `/${url}`
}

const fetchEmojis = async () => {
  if (isSpecialCategory.value) return
  
  loading.value = true
  try {
    const params = {
      category: activeCategory.value,
      search: searchKeyword.value,
      page: currentPage.value,
      limit: pageSize.value
    }
    
    const response = await axios.get(`${API_BASE}/emojis`, { params })
    if (response.data.success) {
      emojis.value = response.data.data
      total.value = response.data.total
    }
  } catch (error) {
    ElMessage.error('获取表情列表失败')
  } finally {
    loading.value = false
  }
}

const fetchFavorites = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_BASE}/favorites`)
    if (response.data.success) {
      favorites.value = response.data.data
      emojis.value = response.data.data
    }
  } catch (error) {
    ElMessage.error('获取收藏列表失败')
  } finally {
    loading.value = false
  }
}

const fetchRecentUsed = async () => {
  loading.value = true
  try {
    const response = await axios.get(`${API_BASE}/recent`)
    if (response.data.success) {
      recentUsed.value = response.data.data
      emojis.value = response.data.data
    }
  } catch (error) {
    ElMessage.error('获取最近使用列表失败')
  } finally {
    loading.value = false
  }
}

const handleCategorySelect = (category) => {
  activeCategory.value = category
  currentPage.value = 1
  searchKeyword.value = ''
  manageMode.value = false
  selectedEmojis.value = []
  
  if (category === 'favorites') {
    fetchFavorites()
  } else if (category === 'recent') {
    fetchRecentUsed()
  } else {
    fetchEmojis()
  }
}

const handleSearch = () => {
  currentPage.value = 1
  fetchEmojis()
}

const handlePageChange = () => {
  fetchEmojis()
}

const isFavorite = (emojiId) => {
  return favorites.value.some(f => f.id === emojiId)
}

const toggleFavorite = async (emoji) => {
  try {
    if (isFavorite(emoji.id)) {
      await axios.delete(`${API_BASE}/favorites/${emoji.id}`)
      ElMessage.success('取消收藏成功')
      favorites.value = favorites.value.filter(f => f.id !== emoji.id)
    } else {
      await axios.post(`${API_BASE}/favorites`, { emoji_id: emoji.id })
      ElMessage.success('收藏成功')
      favorites.value.push(emoji)
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失败')
  }
}

const handleEmojiClick = async (emoji) => {
  if (manageMode.value) {
    toggleSelect(emoji.id)
    return
  }
  
  try {
    await axios.post(`${API_BASE}/recent`, { emoji_id: emoji.id })
  } catch (error) {
    console.error('记录使用失败', error)
  }
}

const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

const handleUploadSuccess = (response) => {
  if (response.success) {
    ElMessage.success('上传成功')
    if (activeCategory.value === 'custom') {
      fetchEmojis()
    }
  } else {
    ElMessage.error('上传失败')
  }
}

const deleteEmoji = async (emoji) => {
  try {
    await ElMessageBox.confirm('确定要删除这个表情吗？', '提示', {
      type: 'warning'
    })
    
    await axios.delete(`${API_BASE}/emojis/${emoji.id}`)
    ElMessage.success('删除成功')
    fetchEmojis()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const toggleManageMode = () => {
  manageMode.value = !manageMode.value
  if (!manageMode.value) {
    selectedEmojis.value = []
  }
}

const toggleSelect = (emojiId) => {
  const index = selectedEmojis.value.indexOf(emojiId)
  if (index > -1) {
    selectedEmojis.value.splice(index, 1)
  } else {
    selectedEmojis.value.push(emojiId)
  }
}

const batchDeleteFavorites = async () => {
  if (selectedEmojis.value.length === 0) {
    ElMessage.warning('请选择要删除的表情')
    return
  }
  
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedEmojis.value.length} 个收藏吗？`, '提示', {
      type: 'warning'
    })
    
    for (const emojiId of selectedEmojis.value) {
      await axios.delete(`${API_BASE}/favorites/${emojiId}`)
    }
    
    ElMessage.success('删除成功')
    selectedEmojis.value = []
    fetchFavorites()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  fetchEmojis()
  fetchFavorites()
})
</script>

<style scoped>
.emoji-manager {
  height: 100vh;
}

.el-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #409eff;
  color: white;
  padding: 0 20px;
}

.el-header h1 {
  margin: 0;
  font-size: 24px;
}

.search-input {
  width: 300px;
}

.el-aside {
  background-color: #f5f7fa;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.el-menu {
  border-right: none;
}

.el-main {
  padding: 20px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.emoji-item {
  position: relative;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
}

.emoji-item:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.emoji-item.selected {
  border-color: #409eff;
  background-color: #ecf5ff;
}

.emoji-item img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.emoji-name {
  margin-top: 8px;
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.emoji-actions {
  position: absolute;
  top: 5px;
  right: 5px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.3s;
}

.emoji-item:hover .emoji-actions {
  opacity: 1;
}

.select-checkbox {
  position: absolute;
  top: 5px;
  left: 5px;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.el-divider {
  margin: 10px 0;
}
</style>
