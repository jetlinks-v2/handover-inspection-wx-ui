<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { state, can } from '../services/session'
import { currentDirectory } from '../services/workspace'
import { problem, act, upload, me } from '../api/handover'
import { enumValue, type Problem, type Photo } from '../types'
import { sources, statuses, formatTime, errorText, actionNames } from '../services/labels'
import PhotoGallery from '../components/PhotoGallery.vue'
import PhotoInput from '../components/PhotoInput.vue'
const route = useRoute(),
  item = ref<Problem>(),
  loading = ref(false),
  error = ref(''),
  action = ref(''),
  description = ref(''),
  reason = ref(''),
  passed = ref(true),
  organizationId = ref<string>(),
  photos = ref<Photo[]>([]),
  busy = ref(false),
  progress = ref(''),
  organizationIds = ref<string[]>([])
const construction = computed(() => route.query.view === 'construction')
const status = computed(() => (item.value ? enumValue(item.value.status) : -1))
const actionModel = computed(() => ({
  organizationId: organizationId.value,
  description: description.value,
  reason: reason.value,
  passed: passed.value
}))
const available = computed(() => {
  if (!item.value) return []
  const result: string[] = []
  if (construction.value) {
    if (item.value.organizationId && organizationIds.value.includes(item.value.organizationId)) {
      if ([0, 4].includes(status.value) && can('accept')) result.push('accept')
      if (status.value === 1 && can('rectify')) result.push('rectify')
    }
  } else {
    if (status.value !== 3 && item.value.initiatorId === state.authorization?.user.id && can('assign'))
      result.push('assign')
    if (status.value === 2) {
      if (enumValue(item.value.auditStage) === 0 && can('initial-review')) result.push('initial-review')
      if (enumValue(item.value.auditStage) === 1 && can('final-review')) result.push('final-review')
    }
    if (can('save')) result.push('photos')
  }
  return result
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [result, identity] = await Promise.all([problem(String(route.params.id)), me()])
    if (result.projectId !== state.projectId) throw Error('问题不属于当前项目，请返回项目列表')
    item.value = result
    organizationIds.value = identity.organizationIds
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    loading.value = false
  }
}
function choose(value: string) {
  action.value = value
  description.value = ''
  reason.value = ''
  photos.value = []
  passed.value = true
  organizationId.value = item.value?.organizationId
  error.value = ''
}
async function submit() {
  if (!item.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    if (!navigator.onLine) throw Error('此操作需联网，请恢复网络后重试')
    if (action.value === 'assign' && !organizationId.value) throw Error('请选择责任单位')
    if (action.value === 'rectify' && !description.value.trim()) throw Error('请填写整改说明')
    if (action.value.includes('review') && !passed.value && !reason.value.trim())
      throw Error('退回必须填写原因')
    if (action.value === 'photos' && !photos.value.length) throw Error('请添加需要补录的照片')
    for (let i = 0; i < photos.value.length; i++) {
      const photo = photos.value[i]
      if (!photo.file)
        photo.file = {
          ...(await upload(photo.blob, photo.name)),
          photoType: action.value === 'rectify' ? 'rectification' : 'problem',
          sortIndex: i
        }
      progress.value = `照片 ${i + 1}/${photos.value.length}`
    }
    item.value = await act(item.value, action.value, {
      organizationId: action.value === 'assign' ? organizationId.value : undefined,
      description: description.value,
      reason: reason.value,
      passed: passed.value,
      photos: photos.value.map((p) => p.file!)
    })
    action.value = ''
    photos.value = []
    await load()
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    busy.value = false
    progress.value = ''
  }
}
onMounted(load)
</script>
<template>
  <section>
    <h1>问题详情</h1>
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
      show-icon
    />
    <MobileLoading :loading="loading">
      <template v-if="item">
        <div class="panel">
          <div class="row between">
            <span>{{ sources[enumValue(item.source)] }}</span>
            <van-tag>
              {{ statuses[status]
              }}{{ status === 2 ? (enumValue(item.auditStage) === 0 ? ' · 待初审' : ' · 待终审') : '' }}
            </van-tag>
          </div>
          <h2>{{ item.title || '查验问题' }}</h2>
          <p class="description">{{ item.description }}</p>
          <dl class="detail-fields">
            <dt>查验时间</dt>
            <dd>{{ formatTime(item.inspectionTime) }}</dd>
            <dt>问题位置</dt>
            <dd>{{ item.spaceName }} {{ item.location || '未填写' }}</dd>
            <dt>问题分类</dt>
            <dd>{{ item.categoryName || '未分类' }}</dd>
            <dt>责任单位</dt>
            <dd>{{ item.organizationName || '待分配' }}</dd>
            <dt>业务发起人</dt>
            <dd>{{ item.initiatorName || '未指定' }}</dd>
            <dt v-if="item.itemId">关联清单</dt>
            <dd v-if="item.itemId">
              {{
                [...(currentDirectory?.physical || []), ...(currentDirectory?.quality || [])].find(
                  (i) => i.id === item!.itemId
                )?.name || item.itemId
              }}
            </dd>
          </dl>
        </div>
        <div class="panel">
          <h2>现场与整改照片</h2>
          <PhotoGallery :photos="item.photos || []" />
        </div>
        <div class="panel">
          <h2>处理记录</h2>
          <van-steps v-if="item.nodes?.length" direction="vertical" :active="999">
            <van-step
              v-for="node in item.nodes"
              :key="node.id"
            >
              <strong>{{ actionNames[node.action] || node.action }}</strong>
              <p>{{ node.operatorName }} · {{ formatTime(node.time) }}</p>
              <p
                v-if="node.description"
                class="description"
              >
                {{ node.description }}
              </p>
            </van-step>
          </van-steps>
          <p
            v-else
            class="muted"
          >
            暂无处理记录
          </p>
        </div>
        <div
          v-if="available.length"
          class="sticky-actions row"
        >
          <van-button
            v-for="value in available"
            :key="value"
            type="primary"
            size="large"
            class="grow"
            :disabled="state.offline"
            @click="choose(value)"
           native-type="button">
            {{ actionNames[value] }}
          </van-button>
        </div>
      </template>
    </MobileLoading>
    <MobilePopup
      :show="!!action"
     
     
      :title="actionNames[action]"
      :closable="!busy"
      @close="!busy && (action = '')"
    >
      <MobileNotice
        v-if="error"
        :message="error"
        type="error"
      />
      <BusinessForm
        layout="vertical"
        :model="actionModel"
        :disabled="busy"
        @submit="submit"
      >
        <BusinessField
          v-if="action === 'assign'"
          label="责任单位"
          name="organizationId"
          required
        >
          <SelectField
            v-model="organizationId"
            :options="currentDirectory?.organizations.map((o) => ({ value: o.id, label: o.name }))"
          />
        </BusinessField>
        <template v-if="action.includes('review')">
          <BusinessField
            label="审核结果"
            name="passed"
          >
            <van-radio-group v-model="passed">
              <van-radio :name="true">通过</van-radio>
              <van-radio :name="false">退回整改</van-radio>
            </van-radio-group>
          </BusinessField>
          <BusinessField
            v-if="!passed"
            label="退回原因"
            name="reason"
            required
          >
            <van-field
              v-model="reason"
              :rows="3"
              :maxlength="2000"
             type="textarea" autosize />
          </BusinessField>
        </template>
        <BusinessField
          label="说明"
          name="description"
          :required="action === 'rectify'"
        >
          <van-field
            v-model="description"
            :rows="3"
            :maxlength="4000"
           type="textarea" autosize />
        </BusinessField>
        <PhotoInput
          v-if="['rectify', 'photos'].includes(action)"
          v-model="photos"
          :disabled="busy"
        />
        <p v-if="progress">{{ progress }}</p>
        <van-button
          type="primary"
          native-type="submit"
          size="large"
          block
          :loading="busy"
        >
          确认{{ actionNames[action] }}
        </van-button>
      </BusinessForm>
    </MobilePopup>
  </section>
</template>
