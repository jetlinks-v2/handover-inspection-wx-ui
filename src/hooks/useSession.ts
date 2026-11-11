import {onBeforeUnmount,reactive,ref,shallowRef,watch} from 'vue'
import {useRouter} from 'vue-router'
import JSEncrypt from 'jsencrypt'
import {request,errorText} from '../api/http'
import {authorize} from '../api/handover'
import {loginRequest} from '../api/login'
import {clearSession,setSession,state,sessionRevision} from '../services/session'
import {hosted,hostBack} from '../services/host'
import {loginApplication} from '../services/projectLogin'
import type {CaptchaRequirement,CaptchaResult} from '../services/projectLogin'
import type {Authorization} from '../types'

export async function verifySession(){const session=state.session;const authorization=await authorize();if(state.session!==session)throw Error('登录上下文已变化');if(!authorization?.user?.id)throw Error('应用授权未返回有效身份');state.authorization=authorization}
export function useSession(){
 const router=useRouter(),loading=ref(false),error=ref('')
 const form=reactive({username:'',password:''})
 const verification=shallowRef<CaptchaRequirement>()
 let controller:AbortController|undefined
 let pending:{resolve:(result:CaptchaResult)=>void;reject:(error:Error)=>void}|undefined
 const cancelVerification=()=>{const wait=pending;pending=undefined;verification.value=undefined;wait?.reject(Error('已取消登录'));controller?.abort()}
 const completeVerification=(result:CaptchaResult)=>{const wait=pending;pending=undefined;verification.value=undefined;wait?.resolve(result)}
 const verify=(requirement:CaptchaRequirement)=>new Promise<CaptchaResult>((resolve,reject)=>{pending={resolve,reject};verification.value=requirement})
 // 修改账号或项目后，旧验证码和旧请求结果不能建立新会话。
 watch(()=>[form.username,form.password],()=>{if(controller)cancelVerification()},{flush:'sync'})
 const login=async()=>{
  if(loading.value)return
  loading.value=true;error.value=''
  const active=new AbortController();controller=active
  const snapshot={...form},revision=sessionRevision()
  try{
   if(!snapshot.username.trim()||!snapshot.password)throw Error('请填写应用账号及密码')
   const config=await loginRequest<{encrypt?:{enabled:boolean;id:string;publicKey:string}}>(state.config,'/authorize/login/configs',undefined,{signal:active.signal})
   let password=snapshot.password
   if(config.encrypt?.enabled){if(!config.encrypt.id||!config.encrypt.publicKey)throw Error('密码加密配置不可用');const rsa=new JSEncrypt();rsa.setPublicKey(config.encrypt.publicKey);const encrypted=rsa.encrypt(password);if(!encrypted)throw Error('密码加密失败，请重试');password=encrypted}
   const result=await loginApplication(state.config,{...snapshot,password,encryptId:config.encrypt?.enabled?config.encrypt.id:undefined},verify,session=>request<Authorization>('/authorize/me',undefined,'GET',true,session),active.signal)
   active.signal.throwIfAborted();if(revision!==sessionRevision())throw Error('登录上下文已变化')
   controller=undefined;setSession(result.session);state.authorization=result.authorization;form.password='';await router.replace('/')
  }catch(e){if(revision===sessionRevision())clearSession();error.value=active.signal.aborted?'已取消登录，请重试':errorText(e)}finally{if(controller===active)controller=undefined;pending=undefined;verification.value=undefined;loading.value=false}
 }
 const logout=async()=>{if(hosted){hostBack();return}loading.value=true;try{await request('/user-token/reset')}catch{/* 本地会话仍须清理。 */}finally{clearSession();loading.value=false;await router.replace('/login')}}
 const expired=()=>{error.value='登录已过期，请重新登录';void router.replace('/login')}
 window.addEventListener('handover:session-expired',expired)
 onBeforeUnmount(()=>{cancelVerification();window.removeEventListener('handover:session-expired',expired)})
 return {form,verification,loading,error,completeVerification,cancelVerification,login,logout}
}
