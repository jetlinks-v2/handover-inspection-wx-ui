import { loginRequest,LoginApiError } from '../api/login'
import type { CaptchaConfig,VerificationHeaders } from '../api/login'
import type { Authorization,RuntimeConfig,Session } from '../types'
import {applicationEntry} from './entry'

export interface CaptchaRequirement {config:CaptchaConfig;key?:string;contextToken?:string}
export interface CaptchaResult {verification?:VerificationHeaders;proof?:string;contextToken?:string;verifyKey?:string;verifyCode?:string}
export interface ApplicationLoginInput {username:string;password:string;encryptId?:string}
export type CaptchaVerifier=(requirement:CaptchaRequirement)=>Promise<CaptchaResult>

/** 使用项目内应用账号认证，再在入口指定应用 Scope 下核验身份；未通过前不向浏览器存储任何登录凭证。 */
export async function loginApplication(config:RuntimeConfig,input:ApplicationLoginInput,verify:CaptchaVerifier,authorize:(session:Session)=>Promise<Authorization>,signal?:AbortSignal){
 const username=input.username.trim(),applicationId=applicationEntry()
 if(!username||!input.password)throw Error('请填写应用账号及密码')
 // 与 PC 应用链接相同，账号原样提交；不截断或补造账号后缀。
 const captcha=await loginRequest<CaptchaConfig>(config,'/authorize/captcha/config',undefined,{signal})
 let proof:CaptchaResult={}
 if(captcha.enabled&&captcha.loginWithVerify!==true){
  if(captcha.type==='altcha'){
   if(!captcha.altcha)throw Error('安全验证配置不可用，请稍后重试')
   const context=await loginRequest<{contextToken:string}>(config,captcha.altcha.contextUrl,{operation:'login.captcha',target:username},{signal})
   proof=await verify({config:captcha,contextToken:context.contextToken})
  }else proof=await verify({config:captcha})
 }
 const body={username,password:input.password,encryptId:input.encryptId,expires:3600000,...proof}
 let account:{token:string}
 try{account=await loginRequest(config,'/authorize/login',body,{signal})}
 catch(error){
  if(!(error instanceof LoginApiError)||!error.verification)throw error
  const completed=await verify({config:captcha,key:error.verification.key})
  if(!completed.verification)throw Error('安全验证未完成，请重试')
  account=await loginRequest(config,'/authorize/login',body,{signal,verification:completed.verification})
 }
 if(!account.token)throw Error('应用登录未返回有效会话')
 const session:Session={token:account.token,applicationId}
 const authorization=await authorize(session)
 if(!authorization?.user?.id)throw Error('应用授权未返回有效身份')
 signal?.throwIfAborted()
 return {session,authorization}
}
