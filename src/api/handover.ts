import { request } from './http'
import { can } from '../services/session'
import { collectDirectory } from '../services/paging'
import type { Authorization, Directory, Entry, Page, Problem, ProblemInput, Source, FileRef } from '../types'
const base = '/property/handover'
export const query = (params: Record<string, unknown>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString()
export const authorize = () => request<Authorization>('/authorize/me')
export const projects = () => request<Entry[]>(base + '/directory/projects')
export const me = () =>
  request<{ id: string; name: string; organizationIds: string[]; employee: boolean }>(base + '/directory/me')
export const problems = (params: Record<string, unknown>) =>
  request<Page<Problem>>(base + '/problem/_query?' + query(params))
export const counts = (params: Record<string, unknown>) =>
  request<{
    total: number
    pending: number
    processing: number
    review: number
    completed: number
    rejected: number
  }>(base + '/problem/_counts?' + query(params))
export const problem = (id: string) => request<Problem>(base + '/problem/' + encodeURIComponent(id))
export const create = (input: ProblemInput) => request<Problem>(base + '/problem', input)
export const act = (item: Problem, action: string, input: Record<string, unknown>) =>
  request<Problem>(base + '/problem/' + encodeURIComponent(item.id) + '/' + action, {
    ...input,
    version: item.version
  })
export const upload = async (blob: Blob, name: string): Promise<FileRef> => {
  const form = new FormData()
  form.append('file', blob, name)
  const file = await request<{ id: string; name?: string; contentType?: string; size?: number }>(
    '/file/upload',
    form
  )
  if (!file.id) throw Error('上传结果缺少文件 ID')
  return {
    fileId: file.id,
    name: file.name || name,
    type: file.contentType || blob.type,
    size: file.size || blob.size
  }
}
const all = <T extends { id: string }>(path: string, params: Record<string, unknown>) =>
  collectDirectory<T>((pageIndex, pageSize) =>
    request<Page<T>>(base + path + '?' + query({ ...params, pageIndex, pageSize }))
  )
export function flatten(rows: Entry[]): Entry[] {
  return rows.flatMap((row) => [row, ...flatten(row.children || [])])
}
export async function directory(projectId: string): Promise<Directory> {
  const [ps, identity] = await Promise.all([projects(), me()])
  // 施工查询不依赖物业录入目录；可选配置接口不能成为接单/整改的隐含权限前置。
  if (!identity.employee || !can('save'))
    return {
      employee: identity.employee,
      projects: ps,
      categories: [],
      organizations: [],
      spaces: [],
      users: [],
      physical: [],
      quality: [],
      cachedAt: Date.now()
    }
  const [categories, organizations, spaces, users, physical, quality] = await Promise.all([
    all<Entry>('/problem-category/_query', { projectId }),
    request<Entry[]>(base + '/directory/organizations?' + query({ projectId })),
    request<Entry[]>(base + '/directory/spaces?' + query({ projectId })),
    all<Entry>('/directory/users', { projectId }),
    all<Entry>('/item/_query', { projectId, source: 'PHYSICAL_HANDOVER' satisfies Source }),
    all<Entry>('/item/_query', { projectId, source: 'QUALITY_ACCEPTANCE' satisfies Source })
  ])
  return {
    employee: identity.employee,
    projects: ps,
    categories,
    organizations: flatten(organizations),
    spaces: flatten(spaces),
    users,
    physical,
    quality,
    cachedAt: Date.now()
  }
}
