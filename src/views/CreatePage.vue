<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, toRaw } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { state, scope, can } from '../services/session'
import { currentDirectory } from '../services/workspace'
import { drafts, saveDraft, removeDraft } from '../services/storage'
import { syncDraft, validateInput } from '../services/sync'
import * as api from '../api/handover'
import { syncDependencies } from '../services/scopedSync'
import { sources, statuses, errorText } from '../services/labels'
import type { Draft, Source } from '../types'
import PhotoInput from '../components/PhotoInput.vue'
const route = useRoute(),
  router = useRouter(),
  draft = ref<Draft>(),
  error = ref(''),
  busy = ref(false),
  savedAt = ref(0),
  progress = ref(''),
  ready = ref(false)
const directory = currentDirectory
const items = computed(() =>
  draft.value?.payload.source === 'PHYSICAL_HANDOVER' ? directory.value?.physical : directory.value?.quality
)
let timer: ReturnType<typeof setTimeout> | undefined
async function persist() {
  if (!draft.value || !ready.value) return
  await saveDraft(toRaw(draft.value))
  savedAt.value = Date.now()
}
watch(
  draft,
  () => {
    if (!ready.value) return
    clearTimeout(timer)
    timer = setTimeout(() => void persist().catch((cause) => (error.value = errorText(cause))), 400)
  },
  { deep: true }
)
onMounted(async () => {
  try {
    if (!can('save')) throw Error('当前账号没有问题录入权限')
    const local = route.query.draft
      ? (await drafts(scope())).find((d) => d.id === route.query.draft)
      : undefined
    if (route.query.draft && !local) throw Error('草稿不存在或不属于当前项目')
    const source = String(route.query.source || 'SITE_INSPECTION') as Source
    if (!sources[source]) throw Error('问题来源无效')
    const requestId = crypto.randomUUID()
    draft.value = local || {
      id: requestId,
      scope: scope(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
      uploaded: 0,
      photos: [],
      payload: {
        projectId: state.projectId!,
        source,
        clientRequestId: requestId,
        description: '',
        status: 0,
        inspectionType: 'handover',
        inspectionTime: Date.now(),
        initiatorId: state.authorization?.user.id,
        photos: []
      }
    }
    ready.value = true
    await persist()
  } catch (cause) {
    error.value = errorText(cause)
  }
})
onBeforeUnmount(() => clearTimeout(timer))
onBeforeRouteLeave(async () => {
  try {
    await persist()
    return true
  } catch (cause) {
    error.value = errorText(cause)
    return false
  }
})
async function submit() {
  if (!draft.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    validateInput(draft.value.payload)
    await persist()
    if (state.offline || state.offlineMode) {
      await router.push('/offline')
      return
    }
    await syncDraft(
      draft.value,
      scope(),
      syncDependencies(),
      (done, total) => (progress.value = `照片 ${done}/${total}`)
    )
    ready.value = false
    await router.replace('/problems/property')
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    busy.value = false
  }
}
const options = (rows: { id: string; name: string; code?: string }[] | undefined) =>
  rows?.map((row) => ({ value: row.id, label: row.name + (row.code ? ' · ' + row.code : '') })) || []
</script>
<template>
  <section>
    <h1>{{ draft ? sources[draft.payload.source] : '问题录入' }}</h1>
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
      show-icon
    />
    <MobileNotice
      v-if="!directory"
      message="此项目没有完整离线目录，请回工作台联网下载后录入"
      type="warning"
    />
    <template v-if="draft">
      <p class="muted">
        {{
          draft.uploadStarted
            ? '已开始上传，内容已锁定；重试沿用原提交编号。'
            : savedAt
              ? '草稿已自动保存到此设备'
              : '正在保存草稿'
        }}
      </p>
      <BusinessForm
        layout="vertical"
        :model="draft.payload"
        :disabled="busy || draft.uploadStarted || !directory"
        @submit="submit"
      >
        <div class="panel">
          <BusinessField
            v-if="draft.payload.source !== 'SITE_INSPECTION'"
            label="关联清单项"
            required
          >
            <SelectField
              v-model="draft.payload.itemId"
              show-search
              
              :options="options(items)"
              placeholder="选择本项目清单项"
            />
          </BusinessField>
          <BusinessField
            v-else
            label="查验类别"
          >
            <van-radio-group v-model="draft.payload.inspectionType">
              <van-radio name="handover">承接查验</van-radio>
              <van-radio name="management">管理权移交</van-radio>
            </van-radio-group>
          </BusinessField>
          <BusinessField
            label="查验时间"
            required
          >
            <input
              class="native-input"
              type="datetime-local"
              :value="
                new Date(draft.payload.inspectionTime - new Date().getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16)
              "
              @change="
                (event) =>
                  (draft!.payload.inspectionTime = new Date(
                    (event.target as HTMLInputElement).value
                  ).getTime())
              "
            />
          </BusinessField>
          <BusinessField label="初始状态">
            <SelectField
              v-model="draft.payload.status"
              :options="
                statuses
                  .map((label, value) => ({ label, value }))
                  .filter((option) => option.value !== 3 || can('final-review'))
              "
            />
          </BusinessField>
          <BusinessField
            label="问题描述"
            required
          >
            <van-field
              v-model="draft.payload.description"
              :rows="4"
              :maxlength="4000"
              show-count
              placeholder="描述问题现象及需要整改的内容"
             type="textarea" autosize />
          </BusinessField>
          <BusinessField label="空间位置">
            <SelectField
              v-model="draft.payload.spaceId"
              clearable
              :options="options(directory?.spaces)"
            />
          </BusinessField>
          <BusinessField label="位置补充">
            <van-field
              v-model="draft.payload.location"
              :maxlength="500"
              placeholder="如：地下车库 B 区东侧"
            />
          </BusinessField>
          <BusinessField label="问题分类">
            <SelectField
              v-model="draft.payload.categoryId"
              clearable
              :options="options(directory?.categories)"
            />
          </BusinessField>
          <BusinessField label="责任单位">
            <SelectField
              v-model="draft.payload.organizationId"
              clearable
              :options="options(directory?.organizations)"
              placeholder="可稍后分配"
            />
          </BusinessField>
          <BusinessField label="业务发起人">
            <SelectField
              v-model="draft.payload.initiatorId"
              :options="options(directory?.users)"
            />
          </BusinessField>
          <p class="hint">实际操作人员由系统记录，业务发起人用于代录。</p>
        </div>
        <div class="panel">
          <h2>问题照片</h2>
          <PhotoInput
            v-model="draft.photos"
            :disabled="draft.uploadStarted || busy"
          />
        </div>
      </BusinessForm>
      <div class="sticky-actions">
        <span v-if="progress">{{ progress }}</span>
        <van-button
          type="primary"
          size="large"
          block
          :loading="busy"
          :disabled="!directory || !can('save')"
          @click="submit"
         native-type="button">
          {{
            draft.uploadStarted
              ? '重试提交'
              : state.offline || state.offlineMode
                ? '保存到待上传'
                : '提交问题'
          }}
        </van-button>
      </div>
    </template>
  </section>
</template>
