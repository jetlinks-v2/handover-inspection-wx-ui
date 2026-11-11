import type { RuntimeConfig } from '../types'

export interface CaptchaConfig {
 enabled:boolean
 type:string
 loginWithVerify?:boolean
 altcha?:{contextUrl:string;challengeUrl:string;prevalidateUrl:string}
}
export interface VerificationRequired {type:string;key:string;disposable:boolean}
export interface VerificationHeaders {key:string;token:string}

export class LoginApiError extends Error {
 status:number
 verification?:VerificationRequired
 constructor(message:string,status:number,verification?:VerificationRequired){super(message);this.status=status;this.verification=verification}
}

/** 与 PC 应用链接相同，登录和验证码请求不携带已有会话、租户或应用 Scope。 */
export async function loginRequest<T>(config:Pick<RuntimeConfig,'apiBase'>,path:string,body?:unknown,options:{token?:string;verification?:VerificationHeaders;signal?:AbortSignal}={}):Promise<T>{
 const base=config.apiBase||'/api'
 if(!base.startsWith('/')||base.startsWith('//')||!path.startsWith('/')||path.startsWith('//')||/[\\#]/.test(path)||decodeURIComponent(path.split('?')[0]).includes('..'))throw Error('登录接口须配置为同源路径')
 const headers:Record<string,string>={'Accept-Language':'zh-CN'}
 if(body!==undefined)headers['Content-Type']='application/json'
 if(options.token)headers['X-Access-Token']=options.token
 if(options.verification){headers['x-verify-key']=options.verification.key;headers['x-verify-token']=options.verification.token}
 const response=await fetch(base.replace(/\/$/,'')+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000)})
 const data=await response.json() as {status?:number;message?:string;code?:string;result:T}
 const status=data.status||response.status
 if(!response.ok||status!==200){
  const result=data.result as VerificationRequired|undefined
  const verification=status===403&&result?.type==='captcha'&&typeof result.key==='string'?result:undefined
  throw new LoginApiError(verification?'请完成安全验证':data.message||'登录请求失败',status,verification)
 }
 return data.result
}
