import { state, scope } from './session'
import { scopeKey, saveDraft, removeDraft } from './storage'
import { upload, create } from '../api/handover'
import type { SyncDependencies } from './sync'
/** Recheck the caller before each network step, including after a project or account switch. */
export function syncDependencies(): SyncDependencies {
  const expected = scopeKey(scope()),
    token = state.session?.token
  const assertCurrent = () => {
    if (state.session?.token !== token || scopeKey(scope()) !== expected)
      throw Error('账号或项目已切换，请返回原账号和项目后重试')
  }
  return {
    save: saveDraft,
    remove: removeDraft,
    upload: (blob, name) => {
      assertCurrent()
      return upload(blob, name)
    },
    submit: (payload) => {
      assertCurrent()
      return create(payload)
    }
  }
}
