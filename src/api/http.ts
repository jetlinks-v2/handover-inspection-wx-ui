import {clearSession,state,sessionRevision} from '../services/session'
import {allowedPath,hosted,hostRequest} from '../services/host'
import type {Session} from '../types'
export class ApiError extends Error {constructor(message:string,public status:number){super(message)}}
export function headers(session=state.session):Record<string,string>{
 if(!session||!session.token)throw new ApiError('请先登录',401)
 return {'X-Access-Token':session.token,'X-Asset-Scope':'business_application:'+session.applicationId,'Accept-Language':'zh-CN'}
}
function expire(session:Session|undefined,revision:number){if(session===state.session&&revision===sessionRevision()){clearSession();window.dispatchEvent(new Event('handover:session-expired'))}}
/** 所有业务及附件共享身份隔离；候选会话仅用于持久化前校验 /authorize/me。 */
async function send<T>(path:string,body:unknown,method:string,scoped:boolean,session:Session|undefined,blob:boolean):Promise<T>{
 if(!allowedPath(path))throw new ApiError('此请求不在应用访问范围内',400)
 if(hosted){if(!scoped)throw Error('APP 模式不使用浏览器认证');return hostRequest<T>(path,method,body,state.projectId,blob)}
 const revision=sessionRevision(),projectId=state.projectId,multipart=body instanceof FormData
 const response=await fetch(state.config.apiBase+path,{method,credentials:'omit',headers:{...(scoped?headers(session):{}),...(body!==undefined&&!multipart?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:multipart?body as FormData:JSON.stringify(body),signal:AbortSignal.timeout(60000)})
 if(scoped&&(revision!==sessionRevision()||projectId!==state.projectId))throw new ApiError('账号或项目已变化，请重新加载',409)
 if(response.status===401){if(scoped)expire(session,revision);throw new ApiError('登录已过期，请重新登录',401)}
 if(blob){if(!response.ok)throw new ApiError('附件无法访问，请检查权限',response.status);const data=await response.blob();if(data.type.includes('json')){const problem=JSON.parse(await data.text());throw new ApiError(problem.message||'附件无法访问',problem.status||400)}if(scoped&&(revision!==sessionRevision()||projectId!==state.projectId))throw new ApiError('账号或项目已变化，请重新加载',409);return data as T}
 const data=await response.json().catch(()=>{throw new ApiError('服务器响应无法读取，请稍后重试',response.status)}) as {status?:number;message?:string;result:T}
 if(scoped&&(revision!==sessionRevision()||projectId!==state.projectId))throw new ApiError('登录上下文已变化，请重新加载',409)
 const status=response.ok?data.status||response.status:response.status
 if(!response.ok||status!==200){if(scoped&&status===401)expire(session,revision);throw new ApiError(data.message||'请求失败，请重试',status)}
 return data.result
}
export function request<T>(path:string,body?:unknown,method=body===undefined?'GET':'POST',scoped=true,session:Session|undefined=state.session):Promise<T>{return send<T>(path,body,method,scoped,session,false)}
export const fileBlob=(id:string)=>downloadBlob('/file/'+encodeURIComponent(id))
export const downloadBlob=(path:string)=>send<Blob>(path,undefined,'GET',true,state.session,true)
export const errorText=(error:unknown)=>error instanceof Error&&error.name==='TimeoutError'?'请求超时，请先核对业务记录再决定是否重试':error instanceof Error?error.message:'操作失败，请重试'
