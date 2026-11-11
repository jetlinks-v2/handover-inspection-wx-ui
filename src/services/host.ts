import {reactive} from 'vue'
export interface MobileContext {
 userId:string; applicationId:string; projectId?:string; environmentId?:string; name?:string
 permissions?:{id:string;actions:string[]}[]
 dimensions?:{type:string;id:string}[]
}
/** 业务侧接入契约：宿主负责认证、应用 Scope、项目头和 multipart；未代表 APP 已实现。 */
export interface BusinessHost {
 context():Promise<MobileContext>
 request<T>(path:string,method:'GET'|'POST'|'PUT'|'DELETE',body?:unknown,options?:{projectId?:string;responseType?:'blob'}):Promise<T>
 back?():void
}
declare global {interface Window {handoverHost?:BusinessHost}}
export const hosted=typeof window!=='undefined'&&(!!window.handoverHost||new URLSearchParams(location.search).get('mode')==='app')
export const hostState=reactive<{context?:MobileContext;error?:string;revision:number}>({revision:0})
let identity=''
export function invalidateHost(message:string):never {
 hostState.error=message;hostState.context=undefined;hostState.revision++
 window.dispatchEvent(new Event('handover:host-invalid'))
 throw Object.assign(Error(message),{status:401})
}
export async function resolveHost():Promise<MobileContext> {
 if(hostState.error)throw Error(hostState.error)
 const revision=hostState.revision
 const bridge=window.handoverHost
 if(!bridge)return invalidateHost('APP 上下文尚未就绪，请返回 APP 重新打开')
 let timer:ReturnType<typeof setTimeout>|undefined
 try {
  const context=await Promise.race([bridge.context(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('APP 上下文准备超时，请重试')),15000)})])
  if(revision!==hostState.revision)throw Error('APP 上下文已变化，请重新打开')
  if(!context||!context.userId?.trim()||!/^[a-zA-Z0-9_-]{1,128}$/.test(context.applicationId))return invalidateHost('APP 登录已过期，请返回 APP')
  const next=JSON.stringify([context.userId,context.applicationId,context.environmentId,context.projectId])
  const entry=new URLSearchParams(location.search).get('applicationScope')
  if(entry&&entry!==context.applicationId)return invalidateHost('应用入口与 APP 上下文不一致，请重新打开')
  if(identity&&identity!==next)return invalidateHost('APP 账号、应用或环境已变化，请重新打开')
  identity=next;hostState.context=context;return context
 }catch(error){if(revision===hostState.revision&&!hostState.error)return invalidateHost(error instanceof Error?error.message:'APP 上下文不可用，请重新打开');throw error}finally{clearTimeout(timer)}
}
export async function initializeHost(){hostState.revision++;identity='';hostState.context=undefined;hostState.error=undefined;return resolveHost()}
export function allowedPath(path:string):boolean {
 if(!path.startsWith('/')||path.startsWith('//')||/[\\#]/.test(path))return false
 let decoded:string;try{decoded=decodeURIComponent(path.split('?')[0])}catch{return false}
 if(decoded.includes('..')||decoded.includes('://')||decoded.includes('\\'))return false
 return path==='/authorize/me'||path==='/user-token/reset'||["/property/handover/", "/file/"].some(prefix=>path.startsWith(prefix))
}
/** 请求前后核验宿主身份，拒收迟到结果；写操作不自动重试。 */
export async function hostRequest<T>(path:string,method:string,body?:unknown,projectId?:string,blob=false):Promise<T> {
 if(!allowedPath(path)||!['GET','POST','PUT','DELETE'].includes(method))throw Error('此请求不在应用访问范围内')
 await resolveHost();const revision=hostState.revision
 try{
  const result=await window.handoverHost!.request<T>(path,method as 'GET'|'POST'|'PUT'|'DELETE',body,{projectId,...blob?{responseType:'blob' as const}:{}})
  if(revision!==hostState.revision)throw Error('APP 上下文已变化，请重新打开')
  await resolveHost();return result
 }catch(error){if((error as {status?:number})?.status===401&&!hostState.error)return invalidateHost('APP 登录已过期，请返回 APP');throw error}
}
export const hostBack=()=>window.handoverHost?.back?.()
