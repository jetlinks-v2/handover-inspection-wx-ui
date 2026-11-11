import { computed, onScopeDispose, ref, watch } from 'vue'
import { counts } from '../api/handover'
import { state, can, scope } from './session'
import { drafts } from './storage'
import { currentDirectory, selectProject, refreshDirectory } from './workspace'
import { errorText } from './labels'

export function useHome() {
  const error = ref(''),
    pending = ref(0),
    total = ref<number>(),
    review = ref<number>()
  const employee = computed(() => currentDirectory.value?.employee ?? can('save'))
  let generation = 0
  async function load() {
    const requestId = ++generation
    error.value = ''
    total.value = undefined
    review.value = undefined
    pending.value = 0
    if (!state.projectId) return
    const current = scope()
    try {
      const local = await drafts(current)
      if (requestId !== generation) return
      pending.value = local.length
      if (navigator.onLine && !state.offlineMode && currentDirectory.value) {
        // 外协账号只读取施工范围统计，不以物业统计权限作为工作台的隐含前置。
        const result = await counts({
          projectId: current.projectId,
          view: employee.value ? 'property' : 'construction'
        })
        if (requestId !== generation) return
        total.value = result.total
        review.value = result.review
      }
    } catch (cause) {
      if (requestId === generation) error.value = errorText(cause)
    }
  }
  async function choose(id: string) {
    error.value = ''
    try {
      await selectProject(id)
    } catch (cause) {
      error.value = errorText(cause)
    }
  }
  async function download() {
    try {
      await refreshDirectory()
      error.value = ''
    } catch (cause) {
      error.value = errorText(cause)
    }
  }
  watch([() => state.projectId, () => currentDirectory.value, () => state.offlineMode], load, {
    immediate: true
  })
  onScopeDispose(() => generation++)
  return { employee, error, pending, total, review, choose, download }
}
