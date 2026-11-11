import type { Scope, Draft, Directory, Authorization } from '../types'
export const scopeKey = (scope: Scope) =>
  JSON.stringify([scope.environmentId, scope.applicationId, scope.userId, scope.projectId])
const database = 'handover-h5-v1'
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: 'key' })
      request.result.createObjectStore('cache', { keyPath: 'key' })
    }
    request.onerror = () => reject(Error('无法打开本地存储，请检查浏览器存储权限'))
    request.onsuccess = () => resolve(request.result)
  })
async function transaction<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    let result: T
    const request = run(tx.objectStore(store))
    request.onsuccess = () => {
      result = request.result
    }
    tx.oncomplete = () => {
      db.close()
      resolve(result)
    }
    tx.onerror = () => {
      db.close()
      reject(Error('本地保存失败，可能空间不足，请清理后重试'))
    }
    tx.onabort = () => {
      db.close()
      reject(Error('本地保存被中断，请重试'))
    }
  })
}
export const saveDraft = (draft: Draft) =>
  transaction('drafts', 'readwrite', (store) =>
    store.put({
      key: scopeKey(draft.scope) + ':' + draft.id,
      draft: {
        ...draft,
        scope: { ...draft.scope },
        payload: JSON.parse(JSON.stringify(draft.payload)),
        photos: draft.photos.map((photo) => ({ ...photo, file: photo.file ? { ...photo.file } : undefined }))
      }
    })
  )
export const removeDraft = (scope: Scope, id: string) =>
  transaction('drafts', 'readwrite', (store) => store.delete(scopeKey(scope) + ':' + id))
export async function drafts(scope: Scope): Promise<Draft[]> {
  const rows = await transaction<{ key: string; draft: Draft }[]>('drafts', 'readonly', (store) =>
    store.getAll()
  )
  return rows
    .filter((row) => scopeKey(row.draft.scope) === scopeKey(scope))
    .map((row) => row.draft)
    .sort((a, b) => a.createdAt - b.createdAt)
}
export const saveDirectory = (scope: Scope, directory: Directory) =>
  transaction('cache', 'readwrite', (store) =>
    store.put({ key: scopeKey(scope), directory: JSON.parse(JSON.stringify(directory)) })
  )
export async function readDirectory(scope: Scope): Promise<Directory | undefined> {
  const row = await transaction<{ directory: Directory } | undefined>('cache', 'readonly', (store) =>
    store.get(scopeKey(scope))
  )
  return row?.directory
}
export async function clearScope(scope: Scope) {
  for (const draft of await drafts(scope)) await removeDraft(scope, draft.id)
  await transaction('cache', 'readwrite', (store) => store.delete(scopeKey(scope)))
}
const authKey = (tenant: string, app: string) => JSON.stringify(['authorization', tenant, app])
async function tokenFingerprint(token: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
    (byte) => byte.toString(16).padStart(2, '0')
  ).join('')
}
export async function saveAuthorization(
  tenant: string,
  app: string,
  token: string,
  authorization: Authorization
) {
  const fingerprint = await tokenFingerprint(token)
  return transaction('cache', 'readwrite', (store) =>
    store.put({
      key: authKey(tenant, app),
      fingerprint,
      authorization: JSON.parse(JSON.stringify(authorization))
    })
  )
}
export async function readAuthorization(
  tenant: string,
  app: string,
  token: string
): Promise<Authorization | undefined> {
  const fingerprint = await tokenFingerprint(token)
  const row = await transaction<{ fingerprint: string; authorization: Authorization } | undefined>(
    'cache',
    'readonly',
    (store) => store.get(authKey(tenant, app))
  )
  return row?.fingerprint === fingerprint ? row.authorization : undefined
}

/** 当前应用身份已在线核验后，按同应用、同用户、同项目承接旧分区草稿；提交编号、照片与上传回执原样保留。 */
export async function migrateLegacyDrafts(scope: Scope): Promise<number> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts')
    const request = store.getAll()
    let count = 0
    request.onsuccess = () => {
      const rows=request.result as {key: string; draft: Draft}[],existingKeys=new Set(rows.map(row=>row.key))
      for (const row of rows) {
        const previous = row.draft.scope
        if (previous.environmentId || previous.applicationId !== scope.applicationId
          || previous.userId !== scope.userId || previous.projectId !== scope.projectId) continue
        const draft = {...row.draft, scope: {...scope}}, key = scopeKey(scope) + ':' + draft.id
        if(existingKeys.has(key)&&key!==row.key)continue
        store.put({key, draft})
        if (key !== row.key) store.delete(row.key)
        count++
      }
    }
    tx.oncomplete = () => { db.close(); resolve(count) }
    tx.onerror = tx.onabort = () => { db.close(); reject(Error('旧草稿恢复失败，原数据已保留，请重试')) }
  })
}
