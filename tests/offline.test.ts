import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Draft, Scope, Directory } from '../src/types'
import {
  drafts,
  saveDraft,
  removeDraft,
  readDirectory,
  saveDirectory,
  clearScope
} from '../src/services/storage'
import { syncDraft, validateInput } from '../src/services/sync'
const scope: Scope = {
  environmentId: 'tenant-a',
  applicationId: 'app-a',
  userId: 'user-a',
  projectId: 'project-a'
}
function draft(): Draft {
  return {
    id: crypto.randomUUID(),
    scope: { ...scope },
    payload: {
      projectId: scope.projectId,
      source: 'SITE_INSPECTION',
      clientRequestId: crypto.randomUUID(),
      description: '消防箱门变形',
      inspectionTime: Date.now(),
      photos: []
    },
    photos: [
      { id: 'photo-1', blob: new Blob(['photo-a'], { type: 'image/jpeg' }), name: '现场.jpg' },
      { id: 'photo-2', blob: new Blob(['photo-b'], { type: 'image/jpeg' }), name: '近景.jpg' }
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attempts: 0,
    uploaded: 0
  }
}
test('IndexedDB restores actual photo blobs and isolates every scope dimension', async () => {
  const row = draft()
  await saveDraft(row)
  const stored = (await drafts(scope)).find((d) => d.id === row.id)!
  assert.equal(await stored.photos[0].blob.text(), 'photo-a')
  for (const key of ['environmentId', 'applicationId', 'userId', 'projectId'] as const)
    assert.equal((await drafts({ ...scope, [key]: 'other' })).length, 0)
  await removeDraft(scope, row.id)
})
test('partial upload failure persists stable file ID and retry only uploads remaining photos', async () => {
  const row = draft()
  await saveDraft(row)
  let calls = 0
  const deps = {
    save: saveDraft,
    remove: removeDraft,
    upload: async () => {
      calls++
      if (calls === 2) throw Error('第二张网络中断')
      return { fileId: 'file-' + calls }
    },
    submit: async () => ({ id: 'problem' })
  }
  await assert.rejects(syncDraft(row, scope, deps), /第二张/)
  const recovered = (await drafts(scope)).find((d) => d.id === row.id)!
  assert.equal(recovered.photos[0].file?.fileId, 'file-1')
  assert.equal(recovered.uploadStarted, true)
  const progress: number[] = []
  await syncDraft(recovered, scope, deps, (done) => progress.push(done))
  assert.equal(calls, 3)
  assert.deepEqual(progress, [1, 2])
  assert.equal(
    (await drafts(scope)).some((d) => d.id === row.id),
    false
  )
})
test('server success with lost response retries same clientRequestId and files, then clears local blobs', async () => {
  const row = draft()
  let uploads = 0,
    attempts = 0
  const ids: string[] = []
  const server = new Map<string, string>()
  const deps = {
    save: saveDraft,
    remove: removeDraft,
    upload: async () => ({ fileId: 'file-' + ++uploads }),
    submit: async (payload: Draft['payload']) => {
      ids.push(payload.clientRequestId)
      server.set(payload.clientRequestId, 'same-problem')
      if (++attempts === 1) throw Error('服务器回包丢失')
      return { id: server.get(payload.clientRequestId) }
    }
  }
  await assert.rejects(syncDraft(row, scope, deps), /回包丢失/)
  const recovered = (await drafts(scope)).find((d) => d.id === row.id)!
  await syncDraft(recovered, scope, deps)
  assert.equal(uploads, 2)
  assert.equal(server.size, 1)
  assert.deepEqual(ids, [row.payload.clientRequestId, row.payload.clientRequestId])
  assert.equal(
    (await drafts(scope)).some((d) => d.id === row.id),
    false
  )
})
test('cross-scope submit never uploads or sends any business request', async () => {
  let touched = false
  await assert.rejects(
    syncDraft(
      draft(),
      { ...scope, userId: 'another' },
      {
        save: async () => {
          touched = true
        },
        remove: async () => {},
        upload: async () => ({ fileId: 'x' }),
        submit: async () => {
          touched = true
        }
      }
    ),
    /不一致/
  )
  assert.equal(touched, false)
})
test('cache cleanup only removes current project draft blobs and directories', async () => {
  const row = draft(),
    other = draft()
  other.scope = { ...scope, projectId: 'project-b' }
  other.payload.projectId = 'project-b'
  await saveDraft(row)
  await saveDraft(other)
  const directory: Directory = {
    projects: [],
    categories: [],
    organizations: [],
    spaces: [],
    users: [],
    physical: [],
    quality: [],
    cachedAt: Date.now()
  }
  await saveDirectory(scope, directory)
  await saveDirectory(other.scope, directory)
  await clearScope(scope)
  assert.equal(await readDirectory(scope), undefined)
  assert.equal((await drafts(scope)).length, 0)
  assert.equal((await drafts(other.scope)).length, 1)
  assert.ok(await readDirectory(other.scope))
  await clearScope(other.scope)
})
test('incomplete non-site problems cannot be submitted', () => {
  const row = draft()
  row.payload.source = 'PHYSICAL_HANDOVER'
  assert.throws(() => validateInput(row.payload), /清单项/)
  row.payload.itemId = 'item-1'
  row.payload.description = ' '
  assert.throws(() => validateInput(row.payload), /描述/)
})

test('旧租户分区草稿仅迁入已核验的同应用同账号同项目，保留照片回执和幂等编号', async () => {
  const {migrateLegacyDrafts} = await import('../src/services/storage')
  const legacy = draft()
  legacy.scope = {tenantDomain:'old',applicationId:scope.applicationId,userId:scope.userId,projectId:scope.projectId} as unknown as Scope
  legacy.uploadStarted=true;legacy.uploaded=1;legacy.photos[0].file={fileId:'stable-file'}
  await saveDraft(legacy)
  assert.equal(await migrateLegacyDrafts({...scope,userId:'other'}),0)
  assert.equal(await migrateLegacyDrafts(scope),1)
  const restored=(await drafts(scope)).find(row=>row.id===legacy.id)!
  assert.equal(restored.payload.clientRequestId,legacy.payload.clientRequestId)
  assert.equal(restored.photos[0].file?.fileId,'stable-file')
  assert.equal(await restored.photos[0].blob.text(),'photo-a')
  assert.equal(await migrateLegacyDrafts(scope),0)
  await removeDraft(scope,restored.id)
})
