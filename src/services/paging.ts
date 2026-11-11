import type { Page } from '../types'

/** 只有快照完整时才覆盖离线目录，拒绝分页期间变化、重复或提前结束的数据。 */
export async function collectDirectory<T extends { id: string }>(
  read: (pageIndex: number, pageSize: number) => Promise<Page<T>>
) {
  const rows: T[] = []
  const seen = new Set<string>()
  let expected: number | undefined
  for (let pageIndex = 0; pageIndex < 1000; pageIndex++) {
    const page = await read(pageIndex, 200)
    expected ??= page.total
    if (
      !Number.isInteger(expected) ||
      expected < 0 ||
      page.total !== expected ||
      page.pageIndex !== pageIndex ||
      !Array.isArray(page.data)
    )
      throw Error('目录已变化或分页不完整，请重新下载')
    for (const row of page.data) {
      if (!row.id || seen.has(row.id)) throw Error('目录出现重复记录，请重新下载')
      seen.add(row.id)
      rows.push(row)
    }
    if (rows.length === expected) return rows
    if (!page.data.length || rows.length > expected) throw Error('目录分页返回不完整，请重新下载')
  }
  throw Error('目录超过下载上限，请联系管理员')
}
