import { ref } from 'vue'
import { state, scope } from './session'
import { directory, projects } from '../api/handover'
import { readDirectory, saveDirectory, scopeKey, migrateLegacyDrafts } from './storage'
import type { Directory } from '../types'
export const currentDirectory = ref<Directory>()
export const directoryLoading = ref(false),
  directoryError = ref('')
const selectedKey = () =>
  JSON.stringify([
    'handover-project',
    state.session?.environmentId,
    state.session?.applicationId,
    state.authorization?.user.id
  ])
export async function selectProject(id: string) {
  state.projectId = id
  sessionStorage.setItem(selectedKey(), id)
  currentDirectory.value = undefined
  directoryError.value = ''
  if (!id) return
  await migrateLegacyDrafts(scope())
  const cached = await readDirectory(scope())
  if (cached) currentDirectory.value = cached
  if (navigator.onLine && !state.offlineMode) await refreshDirectory()
  else if (!cached) directoryError.value = '当前项目尚未下载离线目录，请联网后下载'
}
export async function refreshDirectory() {
  if (!state.projectId) return
  directoryLoading.value = true
  directoryError.value = ''
  const capturedScope = scope()
  try {
    const next = await directory(capturedScope.projectId)
    await saveDirectory(capturedScope, next)
    if (
      state.session &&
      state.authorization &&
      state.projectId &&
      scopeKey(scope()) === scopeKey(capturedScope)
    )
      currentDirectory.value = next
  } catch (cause) {
    directoryError.value = cause instanceof Error ? cause.message : '目录下载失败，请重试'
    throw cause
  } finally {
    directoryLoading.value = false
  }
}
export async function initializeWorkspace() {
  const previous = sessionStorage.getItem(selectedKey())
  if (navigator.onLine && !state.offlineMode) {
    state.projects = await projects()
    if (previous && state.projects.some((p) => p.id === previous)) await selectProject(previous)
  } else if (previous) {
    state.projectId = previous
    await migrateLegacyDrafts(scope())
  const cached = await readDirectory(scope())
    if (cached) {
      state.projects = cached.projects
      currentDirectory.value = cached
    } else state.projectId = undefined
  }
}
