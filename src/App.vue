<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ArrowLeftOutlined, HomeOutlined, LogoutOutlined } from './components/mobile/icons'
import {confirmAction} from './components/mobile/feedback'
import {hosted,hostBack} from './services/host'
import { state, clearSession } from './services/session'
import { verifySession } from './services/auth'
import { initializeWorkspace, currentDirectory } from './services/workspace'
import { request } from './api/http'
import { errorText } from './services/labels'
const router = useRouter(),
  route = useRoute(),
  error = ref(''),
  shellError = ref(false)
function logout() {
  if(hosted){hostBack();return}
  confirmAction({
    title: '退出当前账号？',
    content: '此设备上的草稿会保留，只有相同环境、应用和账号可恢复。',
    okText: '退出',
    cancelText: '取消',
    onOk: async () => {
      try {
        await request('/user-token/reset')
      } catch {
        /* Local credentials must be removed even if the network is unavailable. */
      }
      clearSession()
      currentDirectory.value = undefined
      await router.replace('/login')
    }
  })
}
function network() {
  state.offline = !navigator.onLine
}
function expired() {
  currentDirectory.value = undefined
  void router.replace('/login')
}
function shellFailed() {
  shellError.value = true
}
onMounted(() => {
  window.addEventListener('online', network)
  window.addEventListener('offline', network)
  window.addEventListener('handover:session-expired', expired)
  window.addEventListener('handover:offline-shell-failed', shellFailed)
})
onBeforeUnmount(() => {
  window.removeEventListener('online', network)
  window.removeEventListener('offline', network)
  window.removeEventListener('handover:session-expired', expired)
  window.removeEventListener('handover:offline-shell-failed', shellFailed)
})
</script>
<template>
  
    <div class="app-shell">
      <header
        v-if="state.session"
        class="app-header"
      >
        <van-button
          v-if="route.path !== '/'" plain
          aria-label="返回工作台"
          @click="router.push('/')"
         native-type="button">
          <ArrowLeftOutlined />
        </van-button>
        <van-button
          v-else plain
          aria-label="工作台"
          @click="router.push('/')"
         native-type="button">
          <HomeOutlined />
        </van-button>
        <strong>
          {{ state.projects.find((p) => p.id === state.projectId)?.name || state.config.title }}
        </strong>
        <van-button plain
          aria-label="退出登录"
          @click="logout"
         native-type="button">
          <LogoutOutlined />
        </van-button>
      </header>
      <div
        v-if="state.offline"
        class="offline-banner"
        role="status"
      >
        当前离线 · 草稿保存在此设备
      </div>
      <MobileNotice
        v-if="shellError"
        message="离线启动缓存未就绪，关闭页面后需联网重新打开。请检查 HTTPS 和浏览器设置。"
        type="warning"
      />
      <main>
        <MobileNotice
          v-if="error"
          :message="error"
          type="error"
          show-icon
        >
          <template #action><van-button @click="router.replace('/')" native-type="button">重新加载</van-button></template>
        </MobileNotice>
        <MobileLoading
          v-if="!state.ready"
          text="正在连接查验应用"
        />
        <router-view v-else-if="!error" />
      </main>
    </div>
  
</template>
