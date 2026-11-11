import type { Source } from '../types'
export const sources: Record<Source, string> = {
  SITE_INSPECTION: '现场查验',
  PHYSICAL_HANDOVER: '实物移交',
  QUALITY_ACCEPTANCE: '质保验收'
}
export const statuses = ['待整改', '处理中', '待复验', '已完成', '已退回']
export const actionNames: Record<string, string> = {
  create: '录入问题',
  assign: '分配单位',
  accept: '接收问题',
  rectify: '提交整改',
  'initial-review': '初审',
  'final-review': '终审',
  photos: '补录照片'
}
export const formatTime = (value: number) => new Date(value).toLocaleString('zh-CN', { hour12: false })
export const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : '操作失败，请重试')
