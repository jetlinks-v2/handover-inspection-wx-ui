import type {GlobalComponent} from 'vant'
declare module 'vue' {export interface GlobalComponents {
 BusinessForm:typeof import('./BusinessForm.vue')['default']
 BusinessField:typeof import('./BusinessField.vue')['default']
 SelectField:typeof import('./SelectField.vue')['default']
 DateField:typeof import('./DateField.vue')['default']
 MobileLoading:typeof import('./MobileLoading.vue')['default']
 MobileNotice:typeof import('./MobileNotice.vue')['default']
 MobilePopup:typeof import('./MobilePopup.vue')['default']
 MobileSegments:typeof import('./MobileSegments.vue')['default']
}}
export {}
