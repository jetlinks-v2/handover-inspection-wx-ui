import type { Draft, FileRef, Scope } from '../types'
import { scopeKey } from './storage'
export interface SyncDependencies {
  save: (draft: Draft) => Promise<unknown>
  remove: (scope: Scope, id: string) => Promise<unknown>
  upload: (blob: Blob, name: string) => Promise<FileRef>
  submit: (payload: Draft['payload']) => Promise<unknown>
}
/** Upload IDs are committed before submit. The immutable client request ID survives lost responses. */
export async function syncDraft(
  draft: Draft,
  currentScope: Scope,
  deps: SyncDependencies,
  progress: (done: number, total: number) => void = () => {}
) {
  if (scopeKey(draft.scope) !== scopeKey(currentScope)) throw Error('草稿与当前租户、应用、账号或项目不一致')
  draft.uploadStarted = true
  draft.attempts++
  draft.error = undefined
  await deps.save(draft)
  try {
    for (const photo of draft.photos) {
      if (!photo.file) {
        photo.file = {
          ...(await deps.upload(photo.blob, photo.name)),
          photoType: 'problem',
          sortIndex: draft.photos.indexOf(photo)
        }
        draft.uploaded = draft.photos.filter((p) => p.file).length
        await deps.save(draft)
      }
      progress(draft.photos.filter((p) => p.file).length, draft.photos.length)
    }
    draft.payload.photos = draft.photos.map((p) => p.file!)
    await deps.save(draft)
    await deps.submit(draft.payload)
    await deps.remove(draft.scope, draft.id)
  } catch (error) {
    draft.error = error instanceof Error ? error.message : '同步失败，请重试'
    draft.updatedAt = Date.now()
    await deps.save(draft)
    throw error
  }
}
export function validateInput(payload: Draft['payload']) {
  if (!payload.projectId) throw Error('请选择项目')
  if (!payload.description.trim()) throw Error('请填写问题描述')
  if (payload.description.length > 4000) throw Error('问题描述不能超过 4000 字')
  if (payload.source !== 'SITE_INSPECTION' && !payload.itemId) throw Error('请选择当前项目的清单项')
  if (!Number.isFinite(payload.inspectionTime)) throw Error('请选择查验时间')
}
