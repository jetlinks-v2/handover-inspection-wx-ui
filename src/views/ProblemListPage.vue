<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { state } from '../services/session'
import { currentDirectory } from '../services/workspace'
import { problems, counts } from '../api/handover'
import { sources, statuses, errorText, formatTime } from '../services/labels'
import { enumValue, type Problem } from '../types'
const route = useRoute(),
  router = useRouter(),
  rows = ref<Problem[]>([]),
  total = ref(0),
  loading = ref(false),
  error = ref(''),
  expanded = ref(false),
  page = ref(0)
const filter = reactive({
  source: '',
  keyword: '',
  status: '',
  categoryId: '',
  organizationId: '',
  inspectionTimeFrom: '',
  inspectionTimeTo: ''
})
const summary = ref<{
  pending: number
  processing: number
  review: number
  completed: number
  rejected: number
}>()
let generation = 0
async function load() {
  const requestId = ++generation
  loading.value = true
  error.value = ''
  try {
    if (!state.projectId) throw Error('请先选择项目')
    const params = {
      ...filter,
      projectId: state.projectId,
      view: String(route.params.view),
      inspectionTimeFrom: filter.inspectionTimeFrom
        ? new Date(filter.inspectionTimeFrom + 'T00:00:00').getTime()
        : undefined,
      inspectionTimeTo: filter.inspectionTimeTo
        ? new Date(filter.inspectionTimeTo + 'T23:59:59.999').getTime()
        : undefined
    }
    const [result, count] = await Promise.all([
      problems({ ...params, pageIndex: page.value, pageSize: 12 }),
      counts(params)
    ])
    if (requestId !== generation) return
    rows.value = result.data
    total.value = result.total
    summary.value = count
  } catch (cause) {
    if (requestId === generation) {
      error.value = errorText(cause)
      rows.value = []
    }
  } finally {
    if (requestId === generation) loading.value = false
  }
}
function search() {
  page.value = 0
  void load()
}
watch(
  () => route.params.view,
  () => {
    filter.status = ''
    search()
  }
)
function selectStatus(value: string) {
  filter.status = value
  search()
}
function movePage(offset: number) {
  page.value += offset
  void load()
}
onMounted(load)
const tabs = [
  { key: '0', name: '待整改', count: 'pending' },
  { key: '1', name: '处理中', count: 'processing' },
  { key: '2', name: '待复验', count: 'review' },
  { key: '4', name: '已退回', count: 'rejected' },
  { key: '3', name: '已完成', count: 'completed' }
] as const
</script>
<template>
  <section>
    <h1>{{ route.params.view === 'construction' ? '施工查验' : '物业问题' }}</h1>
    <MobileNotice
      v-if="state.offline"
      message="问题列表需要联网；离线录入请进入待上传草稿"
      type="info"
    />
    <div class="filter-panel">
      <van-search
        v-model="filter.keyword"
        placeholder="搜索问题描述或位置"
        size="large"
        enter-button="查询"
        @search="search"
      />
      <div class="row">
        <SelectField
          v-model="filter.source"
          class="grow"
          :options="[
            { value: '', label: '全部来源' },
            ...Object.entries(sources).map(([value, label]) => ({ value, label }))
          ]"
          @change="search"
        />
        <van-button @click="expanded = !expanded" native-type="button">{{ expanded ? '收起筛选' : '更多筛选' }}</van-button>
      </div>
      <div
        v-if="expanded"
        class="filters"
      >
        <label>
          问题分类
          <SelectField
            v-model="filter.categoryId"
            clearable
            :options="currentDirectory?.categories.map((c) => ({ value: c.id, label: c.name }))"
          />
        </label>
        <label>
          责任单位
          <SelectField
            v-model="filter.organizationId"
            clearable
            :options="currentDirectory?.organizations.map((c) => ({ value: c.id, label: c.name }))"
          />
        </label>
        <label>
          查验开始日期
          <input
            v-model="filter.inspectionTimeFrom"
            class="native-input"
            type="date"
          />
        </label>
        <label>
          查验结束日期
          <input
            v-model="filter.inspectionTimeTo"
            class="native-input"
            type="date"
          />
        </label>
        <van-button
          type="primary"
          @click="search"
         native-type="button">
          应用筛选
        </van-button>
      </div>
    </div>
    <div
      class="status-tabs"
      role="tablist"
      aria-label="问题状态"
    >
      <button
        :aria-selected="filter.status === ''"
        role="tab"
        :class="{ active: filter.status === '' }"
        @click="selectStatus('')"
      >
        全部
      </button>
      <button
        v-for="tab in tabs"
        :key="tab.key"
        role="tab"
        :aria-selected="filter.status === tab.key"
        :class="{ active: filter.status === tab.key }"
        @click="selectStatus(tab.key)"
      >
        {{ tab.name }}
        <span v-if="summary">{{ summary[tab.count] }}</span>
      </button>
    </div>
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
      show-icon
    >
      <template #action><van-button @click="load" native-type="button">重试</van-button></template>
    </MobileNotice>
    <MobileLoading :loading="loading">
      <div class="problem-list">
        <button
          v-for="item in rows"
          :key="item.id"
          class="problem-row"
          @click="router.push({ path: '/problem/' + item.id, query: { view: route.params.view } })"
        >
          <div class="row between">
            <span class="source-label">
              {{ sources[typeof item.source === 'object' ? enumValue(item.source) : item.source] }}
            </span>
            <van-tag
              :color="
                enumValue(item.status) === 3
                  ? 'success'
                  : enumValue(item.status) === 4
                    ? 'error'
                    : 'processing'
              "
            >
              {{ statuses[enumValue(item.status)]
              }}{{
                enumValue(item.status) === 2
                  ? enumValue(item.auditStage) === 0
                    ? ' · 待初审'
                    : ' · 待终审'
                  : ''
              }}
            </van-tag>
          </div>
          <h2>{{ item.title || item.description }}</h2>
          <p>{{ item.location || item.spaceName || '未填写位置' }}</p>
          <div class="row between muted">
            <span>{{ item.organizationName || '待分配单位' }}</span>
            <time>{{ formatTime(item.inspectionTime) }}</time>
          </div>
        </button>
      </div>
      <van-empty
        v-if="!loading && !rows.length && !error"
        description="当前筛选下暂无问题"
      />
    </MobileLoading>
    <div class="pagination">
      <van-button
        :disabled="page === 0 || loading"
        @click="movePage(-1)"
       native-type="button">
        上一页
      </van-button>
      <span>{{ page + 1 }} / {{ Math.max(1, Math.ceil(total / 12)) }} · {{ total }} 条</span>
      <van-button
        :disabled="(page + 1) * 12 >= total || loading"
        @click="movePage(1)"
       native-type="button">
        下一页
      </van-button>
    </div>
  </section>
</template>
