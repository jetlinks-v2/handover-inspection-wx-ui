import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectDirectory } from '../src/services/paging'

test('H5目录取全451条，不因200条分页截断', async () => {
  const rows = Array.from({ length: 451 }, (_, i) => ({ id: String(i) }))
  const pages: number[] = []
  const result = await collectDirectory(async (pageIndex, pageSize) => {
    pages.push(pageIndex)
    return {
      data: rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
      total: 451,
      pageIndex,
      pageSize
    }
  })
  assert.equal(result.length, 451)
  assert.deepEqual(pages, [0, 1, 2])
})
test('H5目录变化、重复和提前空页拒绝替换完整离线缓存', async () => {
  await assert.rejects(
    collectDirectory(async (pageIndex) => ({ data: [{ id: 'same' }], total: 2, pageIndex, pageSize: 200 })),
    /重复/
  )
  await assert.rejects(
    collectDirectory(async (pageIndex) => ({
      data: pageIndex ? [] : [{ id: 'one' }],
      total: 2,
      pageIndex,
      pageSize: 200
    })),
    /不完整/
  )
  await assert.rejects(
    collectDirectory(async (pageIndex) => ({
      data: [{ id: String(pageIndex) }],
      total: pageIndex ? 3 : 2,
      pageIndex,
      pageSize: 200
    })),
    /变化/
  )
})
test('施工账号目录不调用需要物业权限的分类、员工和清单接口', async () => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: {
      getItem: (key: string) => store.get(key) || null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key)
    },
    configurable: true
  })
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
  const { state } = await import('../src/services/session')
  state.session = { token: 'test-only', environmentId: 'test', applicationId: 'handover' }
  state.authorization = {
    user: { id: 'construction' },
    permissions: [{ id: 'handover-problem', actions: ['query', 'accept', 'rectify'] }]
  }
  const requested: string[] = []
  globalThis.fetch = async (input) => {
    const path = String(input)
    requested.push(path)
    const result = path.endsWith('/directory/me')
      ? { id: 'construction', employee: false, organizationIds: ['unit-a'] }
      : path.endsWith('/directory/projects')
        ? [{ id: 'p', name: '项目' }]
        : null
    assert.notEqual(result, null, '不应请求物业录入目录: ' + path)
    return new Response(JSON.stringify({ status: 200, result }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  const { directory } = await import('../src/api/handover')
  const result = await directory('p')
  assert.equal(result.employee, false)
  assert.equal(result.projects.length, 1)
  assert.equal(requested.length, 2)
})
