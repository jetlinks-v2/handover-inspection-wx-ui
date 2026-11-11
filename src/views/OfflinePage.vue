<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {confirmAction} from '../components/mobile/feedback'
import { state, scope, can } from '../services/session'
import { currentDirectory } from '../services/workspace'
import { drafts, saveDraft, removeDraft, clearScope } from '../services/storage'
import { syncDraft, validateInput } from '../services/sync'
import * as api from '../api/handover'
import { syncDependencies } from '../services/scopedSync'
import type { Draft } from '../types'
import { sources, formatTime, errorText } from '../services/labels'
const router = useRouter(),
  rows = ref<Draft[]>([]),
  busy = ref(false),
  error = ref(''),
  progress = ref(''),
  success = ref(0),
  failed = ref(0)
async function load() {
  try {
    rows.value = await drafts(scope())
  } catch (cause) {
    error.value = errorText(cause)
  }
}
async function sync(selected: Draft[]) {
  if (busy.value) return
  busy.value = true
  success.value = 0
  failed.value = 0
  error.value = ''
  try {
    if (!can('save')) throw Error('当前账号没有录入权限')
    if (!navigator.onLine) throw Error('当前设备离线，请联网后上传')
    await api.authorize()
    for (let i = 0; i < selected.length; i++) {
      const draft = selected[i]
      try {
        validateInput(draft.payload)
        await syncDraft(
          draft,
          scope(),
          syncDependencies(),
          (done, total) => (progress.value = `第 ${i + 1}/${selected.length} 条 · 照片 ${done}/${total}`)
        )
        success.value++
      } catch (cause) {
        failed.value++
        draft.error = errorText(cause)
        await saveDraft(draft)
      }
      await load()
    }
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    busy.value = false
    progress.value = ''
  }
}
function discard(draft: Draft) {
  confirmAction({
    title: '删除此设备上的草稿？',
    content: draft.uploadStarted
      ? '此记录可能已提交成功但未收到回包。建议先重试确认结果，删除后将无法沿用原提交编号。'
      : '草稿及本地照片将从此设备清除。',
    okText: '删除草稿',
    cancelText: '保留',
    danger: true,
    onOk: async () => {
      await removeDraft(scope(), draft.id)
      await load()
    }
  })
}
function clear() {
  confirmAction({
    title: '清理当前项目离线数据？',
    content:
      '当前环境、应用、账号和项目的所有草稿、照片及离线目录都会清除。已开始上传的记录建议先重试确认结果。',
    okText: '确认清理',
    cancelText: '保留',
    danger: true,
    onOk: async () => {
      await clearScope(scope())
      currentDirectory.value = undefined
      await load()
    }
  })
}
onMounted(load)
</script>
<template>
  <section>
    <h1>离线同步中心</h1>
    <p class="muted">
      {{ rows.length }} 条草稿保存在此设备。上传成功后自动清理本地照片，失败草稿保留原内容与提交编号。
    </p>
    <MobileNotice
      v-if="state.offline"
      message="当前离线，可查看与继续录入，联网后上传"
      type="warning"
    />
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
    />
    <MobileNotice
      v-if="success || failed"
      :message="`本次成功 ${success} 条，失败 ${failed} 条`"
      :type="failed ? 'warning' : 'success'"
    />
    <div
      v-if="busy"
      class="panel"
    >
      <MobileLoading />
      {{ progress }}
    </div>
    <div
      v-for="draft in rows"
      :key="draft.id"
      class="panel"
    >
      <div class="row between">
        <strong>{{ sources[draft.payload.source] }}</strong>
        <van-tag>{{ draft.uploadStarted ? '待重试' : '本地草稿' }}</van-tag>
      </div>
      <p class="description">{{ draft.payload.description || '尚未填写描述' }}</p>
      <p class="muted">
        {{ formatTime(draft.createdAt) }} · {{ draft.photos.length }} 张照片 · 已上传 {{ draft.uploaded }} 张
        · 尝试 {{ draft.attempts }} 次
      </p>
      <MobileNotice
        v-if="draft.error"
        :message="draft.error"
        type="error"
      />
      <div class="row">
        <van-button
          :disabled="busy"
          @click="router.push({ path: '/create', query: { draft: draft.id } })"
         native-type="button">
          {{ draft.uploadStarted ? '查看' : '继续编辑' }}
        </van-button>
        <van-button
          type="primary"
          :disabled="busy || state.offline"
          @click="sync([draft])"
         native-type="button">
          {{ draft.attempts ? '重试' : '上传' }}
        </van-button>
        <van-button
          type="danger"
          :disabled="busy"
          @click="discard(draft)"
         native-type="button">
          删除
        </van-button>
      </div>
    </div>
    <van-empty
      v-if="!rows.length"
      description="暂无待上传草稿"
    />
    <div class="sticky-actions">
      <van-button
        type="primary"
        size="large"
        block
        :loading="busy"
        :disabled="!rows.length || state.offline"
        @click="sync(rows.slice())"
       native-type="button">
        全部上传
      </van-button>
      <van-button
        block
        type="danger"
        :disabled="busy"
        @click="clear"
       native-type="button">
        清理当前项目离线数据
      </van-button>
    </div>
  </section>
</template>
