import {reactive} from 'vue'
import type {Authorization,RuntimeConfig,Session,Scope,Entry} from '../types'
import {applicationEntry,apiBase} from './entry'
import {hosted,initializeHost,hostState} from './host'
export const state=reactive<{config:RuntimeConfig;session?:Session;authorization?:Authorization;projectId?:string;ready:boolean;projects:Entry[];offline:boolean;offlineMode:boolean}>({config:{title:'承接查验',apiBase:'/api'},ready:false,projects:[],offline:!navigator.onLine,offlineMode:typeof sessionStorage!=='undefined'&&sessionStorage.getItem('handover:offline-mode')==='true'})
const KEY='handover-h5:session:v2'
let revision=0
export const sessionRevision=()=>revision
export const requestedApplicationId=()=>hosted?hostState.context?.applicationId||applicationEntry():applicationEntry()
export async function initializeConfig(){
 clearSession(false)
 const response=await fetch((import.meta.env?.BASE_URL||'/handover-h5/')+'config.json',{cache:'no-store',credentials:'omit'})
 if(!response.ok)throw Error('无法加载应用配置，请刷新重试')
 const config=await response.json() as RuntimeConfig
 state.config={title:config.title||'承接查验',apiBase:apiBase(config.apiBase)}
 if(hosted){
  const context=await initializeHost()
  state.session={token:'',applicationId:context.applicationId,environmentId:context.environmentId||location.origin}
  state.authorization={user:{id:context.userId,name:context.name},permissions:context.permissions||[]}
  return
 }
 const id=applicationEntry()
 try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null') as Session|null
  if(saved?.token&&saved.applicationId===id)setSession(saved)
  else sessionStorage.removeItem(KEY)
 }catch{sessionStorage.removeItem(KEY)}
}
export function setSession(value:Session){
 if(hosted)throw Error('APP 模式由宿主管理登录')
 if(value.applicationId!==applicationEntry()||!value.token)throw Error('应用登录上下文不一致')
 const session:Session={token:value.token,applicationId:value.applicationId,environmentId:location.origin}
 sessionStorage.setItem(KEY,JSON.stringify(session));revision++;state.authorization=undefined;state.projectId=undefined;state.session=session
 state.projects=[]
}
export function clearSession(removeStored=true){revision++;state.session=undefined;state.authorization=undefined;state.projectId=undefined;state.projects=[];if(removeStored)sessionStorage.removeItem(KEY)}
export const can=(action:string)=>!!state.authorization?.permissions.some(p=>p.id==='handover-problem'&&p.actions.includes(action))

if(typeof window!=='undefined')window.addEventListener('handover:host-invalid',()=>clearSession(false))
export function setOfflineMode(value:boolean){state.offlineMode=value;sessionStorage.setItem('handover:offline-mode',String(value))}
export function scope():Scope {
 if(!state.session||!state.authorization||!state.projectId)throw Error('请先登录并选择项目')
 return {environmentId:state.session.environmentId||location.origin,applicationId:state.session.applicationId,userId:state.authorization.user.id,projectId:state.projectId}
}
