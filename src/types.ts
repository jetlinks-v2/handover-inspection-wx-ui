export type Source = 'SITE_INSPECTION' | 'PHYSICAL_HANDOVER' | 'QUALITY_ACCEPTANCE'
export type EnumValue<T extends string | number> = T | { value: T; text: string }
export interface Session { token:string; applicationId:string; environmentId?:string }
export interface RuntimeConfig { title:string; apiBase:string }
export interface Authorization {
  user: { id: string; name?: string }
  permissions: { id: string; actions: string[] }[]
}
export interface Entry {
  id: string
  name: string
  fullName?: string
  children?: Entry[]
  code?: string
}
export interface Page<T> {
  data: T[]
  total: number
  pageIndex: number
  pageSize: number
}
export interface FileRef {
  fileId: string
  name?: string
  type?: string
  size?: number
  photoType?: 'problem' | 'rectification'
  sortIndex?: number
}
export interface ProblemInput {
  projectId: string
  source: Source
  clientRequestId: string
  itemId?: string
  description: string
  title?: string
  location?: string
  spaceId?: string
  categoryId?: string
  organizationId?: string
  inspectionType?: 'management' | 'handover'
  inspectionTime: number
  initiatorId?: string
  status?: number
  photos: FileRef[]
}
export interface Problem extends Omit<ProblemInput, 'source' | 'status'> {
  id: string
  version: number
  status: EnumValue<number>
  auditStage: EnumValue<number>
  source: EnumValue<Source>
  spaceName?: string
  categoryName?: string
  organizationName?: string
  initiatorName?: string
  createTime: number
  nodes: ProblemNode[]
}
export interface ProblemNode {
  id: string
  action: string
  operatorName: string
  time: number
  description?: string
}
export interface Directory {
  employee?: boolean
  projects: Entry[]
  categories: Entry[]
  organizations: Entry[]
  spaces: Entry[]
  users: Entry[]
  physical: Entry[]
  quality: Entry[]
  cachedAt: number
}
export interface Scope {
  environmentId: string
  applicationId: string
  userId: string
  projectId: string
}
export interface Photo {
  id: string
  blob: Blob
  name: string
  file?: FileRef
}
export interface Draft {
  id: string
  scope: Scope
  payload: ProblemInput
  photos: Photo[]
  createdAt: number
  updatedAt: number
  attempts: number
  error?: string
  uploadStarted?: boolean
  uploaded: number
}
export const enumValue = <T extends string | number>(value: EnumValue<T>): T =>
  typeof value === 'object' ? value.value : value
