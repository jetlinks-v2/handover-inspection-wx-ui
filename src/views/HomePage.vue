<script setup lang="ts">
import { useRouter } from 'vue-router'
import { PlusOutlined, UnorderedListOutlined, CloudSyncOutlined, ToolOutlined } from '../components/mobile/icons'
import { state, can, setOfflineMode } from '../services/session'
import { currentDirectory, directoryLoading, directoryError } from '../services/workspace'
import { sources, formatTime } from '../services/labels'
import { useHome } from '../services/useHome'
const router = useRouter()
const { employee, error, pending, total, review, choose, download } = useHome()
</script>
<template>
  <section>
    <h1>查验工作台</h1>
    <label
      class="field-label"
      for="project-select"
    >
      当前项目
    </label>
    <SelectField
      id="project-select"
      :model-value="state.projectId"
      placeholder="选择有权限的项目"
      :options="state.projects.map((p) => ({ value: p.id, label: p.fullName || p.name }))"
      size="large"
      class="full-width"
      @change="(value: unknown) => choose(String(value))"
    />
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
      show-icon
    />
    <template v-if="state.projectId">
      <section
        v-if="employee"
        class="panel"
      >
        <h2>物业查验</h2>
        <p class="muted">
          {{ total === undefined ? '联网后查看项目问题' : `项目问题 ${total} 条 · 待复验 ${review} 条` }}
        </p>
        <div class="entry-list">
          <van-button
            v-if="can('save')"
            v-for="(label, source) in sources"
            :key="source"
            size="large"
            block
            @click="router.push({ path: '/create', query: { source } })"
           native-type="button">
            <PlusOutlined />
            录入{{ label }}问题
          </van-button>
          <van-button
            size="large"
            block
            @click="router.push('/problems/property')"
           native-type="button">
            <UnorderedListOutlined />
            查看物业问题
          </van-button>
        </div>
      </section>
      <section class="panel">
        <h2>施工查验</h2>
        <p class="muted">查看所属单位可处理的问题，接收并提交整改。</p>
        <van-button
          size="large"
          block
          @click="router.push('/problems/construction')"
         native-type="button">
          <ToolOutlined />
          进入施工查验
        </van-button>
      </section>
      <section class="panel">
        <div class="row between">
          <h2>离线工作</h2>
          <van-switch
            :checked="state.offlineMode"
            checked-children="离线录入"
            un-checked-children="在线录入"
            @change="(value: unknown) => setOfflineMode(Boolean(value))"
          />
        </div>
        <p class="muted">
          {{
            currentDirectory ? `目录更新于 ${formatTime(currentDirectory.cachedAt)}` : '下载目录后可断网录入'
          }}
        </p>
        <MobileNotice
          v-if="directoryError"
          :message="directoryError"
          type="warning"
        />
        <div class="entry-list">
          <van-button
            block
            :loading="directoryLoading"
            :disabled="state.offline"
            @click="download"
           native-type="button">
            更新离线目录
          </van-button>
          <van-button
            block
            @click="router.push('/offline')"
           native-type="button">
            <CloudSyncOutlined />
            待上传草稿 {{ pending }} 条
          </van-button>
        </div>
      </section>
    </template>
    <van-empty
      v-else
      description="选择项目后开始查验"
    />
  </section>
</template>
