import {test,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {applicationEntry,apiBase} from '../src/services/entry'
import {fieldRules} from '../src/components/mobile/formContext'
const values=new Map<string,string>()
Object.assign(globalThis,{window:new EventTarget(),location:{search:'?applicationScope=app-a',origin:'https://h5.example'},sessionStorage:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)}})
const {state,setSession,clearSession,initializeConfig}=await import('../src/services/session')
const {request,downloadBlob}=await import('../src/api/http')
const {loginRequest}=await import('../src/api/login')
const {loginApplication}=await import('../src/services/projectLogin')
const host=await import('../src/services/host')
const auth={user:{id:'person'},permissions:[]}
function ok(result:unknown,status=200){return new Response(JSON.stringify({status,result,message:status===200?'success':'denied'}),{status})}
function session(token='fixture'){setSession({token,applicationId:'app-a'})}
beforeEach(()=>{values.clear();clearSession();Object.assign(location,{search:'?applicationScope=app-a'});state.config={title:'test',apiBase:'/api'};state.projectId=undefined;host.hostState.error=undefined;Reflect.deleteProperty(window,'handoverHost')})
test('具体应用入口拒绝裸链接、重复参数、非法ID和URL凭据',()=>{
 assert.equal(applicationEntry('?applicationScope=app-a'),'app-a')
 for(const search of ['', '?applicationScope=bad%2Fid','?applicationScope=a&applicationScope=b','?applicationScope=a&token=secret'])assert.throws(()=>applicationEntry(search))
})
test('API部署配置拒绝外部URL、反斜线、编码路径和查询覆盖',()=>{
 assert.equal(apiBase('/api/'),'/api')
 for(const value of ['https://other.test','//other.test','/api?override=1','/a/../b','/%2e%2e/api','/api\\other'])assert.throws(()=>apiBase(value))
})
test('运行配置只接受标题和同源API；不继承历史应用及租户',async()=>{
 values.set('handover-h5:session:v2',JSON.stringify({token:'fixture',applicationId:'app-b',tenantDomain:'old'}))
 globalThis.fetch=async()=>new Response(JSON.stringify({title:'test',apiBase:'/api',applicationId:'ignored',tenantDomain:'ignored'}))
 await initializeConfig();assert.equal(state.session,undefined);assert.deepEqual(state.config,{title:'test',apiBase:'/api'})
})
test('同一入口可恢复本人候选会话，持久化时只保留应用与环境',async()=>{
 session();globalThis.fetch=async()=>new Response(JSON.stringify({title:'test',apiBase:'/api'}));await initializeConfig()
 assert.equal(state.session?.applicationId,'app-a');assert.equal(state.authorization,undefined)
 assert.equal(JSON.stringify([...values]).includes('tenantDomain'),false)
})
test('公开登录请求没有PC或旧H5凭据、租户与应用Scope',async()=>{
 session();globalThis.fetch=async(_url,init)=>{const headers=new Headers(init?.headers);for(const name of ['X-Access-Token','X-Asset-Scope','X-Tenant-Domain'])assert.equal(headers.get(name),null);assert.equal(init?.credentials,'omit');return ok({token:'next'})}
 await loginRequest(state.config,'/authorize/login',{username:'worker',password:'fixture'})
})
test('账号原样提交，当前应用成员缺少查询权限仍可建立身份',async()=>{
 const calls:string[]=[]
 globalThis.fetch=async(url,init)=>{calls.push(String(url));if(String(url).endsWith('/config'))return ok({enabled:false,type:'image'});assert.equal(JSON.parse(String(init?.body)).username,'worker@suffix');return ok({token:'next'})}
 const result=await loginApplication(state.config,{username:'worker@suffix',password:'fixture'},async()=>{throw Error('unexpected')},async candidate=>{assert.equal(candidate.applicationId,'app-a');return auth})
 assert.deepEqual(result.authorization,auth);assert.deepEqual(calls,['/api/authorize/captcha/config','/api/authorize/login'])
})
test('缺少入口或账号密码时不发送认证请求',async()=>{
 globalThis.fetch=async()=>{throw Error('unexpected request')}
 location.search='';await assert.rejects(loginApplication(state.config,{username:'worker',password:'fixture'},async()=>({}),async()=>auth),/具体应用/)
 location.search='?applicationScope=app-a';await assert.rejects(loginApplication(state.config,{username:'',password:'fixture'},async()=>({}),async()=>auth),/应用账号/)
})
test('平台拒绝应用成员时不保存会话',async()=>{
 globalThis.fetch=async url=>String(url).endsWith('/config')?ok({enabled:false,type:'image'}):ok({token:'next'})
 await assert.rejects(loginApplication(state.config,{username:'worker',password:'fixture'},async()=>({}),async()=>{throw Error('not a member')}),/not a member/)
 assert.equal(state.session,undefined);assert.equal(values.size,0)
})
test('旧版图片验证配置和新版挑战均先完成验证再提交',async()=>{
 let stage=0
 globalThis.fetch=async(_url,init)=>{stage++;if(stage===1)return ok({enabled:true,type:'image'});const body=JSON.parse(String(init?.body));assert.equal(body.verifyCode,'1234');return ok({token:'next'})}
 await loginApplication(state.config,{username:'worker',password:'fixture'},async()=>({verifyKey:'key',verifyCode:'1234'}),async()=>auth)
 assert.equal(stage,2)
 stage=0
 globalThis.fetch=async(_url,init)=>{stage++;if(stage===1)return ok({enabled:true,type:'image',loginWithVerify:true});if(stage===2)return ok({type:'captcha',key:'challenge',disposable:true},403);assert.equal(new Headers(init?.headers).get('x-verify-token'),'verified');return ok({token:'next'})}
 await loginApplication(state.config,{username:'worker',password:'fixture'},async requirement=>{assert.equal(requirement.key,'challenge');return {verification:{key:'challenge',token:'verified'}}},async()=>auth)
 assert.equal(stage,3)
})
test('取消安全验证不再提交登录请求',async()=>{
 let count=0;globalThis.fetch=async()=>{count++;return ok({enabled:true,type:'image'})}
 await assert.rejects(loginApplication(state.config,{username:'worker',password:'fixture'},async()=>{throw Error('cancelled')},async()=>auth),/cancelled/);assert.equal(count,1)
})
test('业务请求只绑定当前H5 token及具体应用，不发送租户头',async()=>{
 session();globalThis.fetch=async(_url,init)=>{const headers=new Headers(init?.headers);assert.equal(headers.get('X-Access-Token'),'fixture');assert.equal(headers.get('X-Asset-Scope'),'business_application:app-a');assert.equal(headers.get('X-Tenant-Domain'),null);return ok(auth)}
 await request('/authorize/me')
})
test('403保留本人会话，401清理当前会话',async()=>{
 session();globalThis.fetch=async()=>ok(null,403);await assert.rejects(request('/authorize/me'));assert.ok(state.session)
 globalThis.fetch=async()=>ok(null,401);await assert.rejects(request('/authorize/me'));assert.equal(state.session,undefined)
})
test('旧账号迟到401不能清除新账号会话',async()=>{
 session('old');let resolve!:(response:Response)=>void;globalThis.fetch=()=>new Promise(done=>resolve=done)
 const pending=request('/authorize/me');session('new');resolve(ok(null,401));await assert.rejects(pending,/已变化/);assert.equal(state.session?.token,'new')
})
test('切换业务项目后拒收旧查询结果',async()=>{
 session();state.projectId='one';let resolve!:(response:Response)=>void;globalThis.fetch=()=>new Promise(done=>resolve=done)
 const pending=request('/authorize/me');state.projectId='two';resolve(ok(auth));await assert.rejects(pending,/项目已变化/)
})
test('multipart上传保持FormData原对象且不补造Content-Type',async()=>{
 session();const form=new FormData();form.append('file',new Blob(['photo']),'photo.jpg')
 globalThis.fetch=async(_url,init)=>{assert.equal(init?.body,form);assert.equal(new Headers(init?.headers).get('Content-Type'),null);return ok({id:'file'})}
 await request('/file/upload',form)
})
test('业务白名单拒绝跨域、跨业务和编码穿越',async()=>{
 session();globalThis.fetch=async()=>{throw Error('unexpected request')}
 for(const path of ['//other.test/path','/not-this-business','/file/%2e%2e/authorize/me','/file/a%5cb'])await assert.rejects(request(path),/访问范围/)
})
test('Vant字段保留必填数组、空白、正则与数字边界验证',async()=>{
 const check=(rule:Parameters<typeof fieldRules>[0][number],value:unknown)=>fieldRules([rule])[0].validator!(value,{} as never)
 assert.equal(await check({required:true},[]),false);assert.equal(await check({required:true},false),true)
 assert.equal(await check({whitespace:true},'   '),false);assert.equal(await check({min:1},[]),true)
 assert.equal(await check({pattern:/^1\d{10}$/},'wrong'),false);assert.equal(await check({min:0,max:10},11),false)
})
test('宿主缺失不使用浏览器凭据兜底',async()=>{await assert.rejects(host.initializeHost(),/APP/);assert.equal(values.size,0)})
test('宿主上下文读取失败卸载旧业务身份',async()=>{Object.assign(window,{handoverHost:{context:async()=>{throw Error('APP context unavailable')}}});await assert.rejects(host.initializeHost(),/APP context/);assert.ok(host.hostState.error)})
test('宿主请求核对前后用户、应用和环境，拒绝迟到结果',async()=>{
 let context={userId:'person',applicationId:'app-a',environmentId:'one'}
 Object.assign(window,{handoverHost:{context:async()=>context,request:async()=>{context={...context,userId:'other'};return 'stale'}}})
 await host.initializeHost();await assert.rejects(host.hostRequest('/authorize/me','GET'),/已变化/);assert.ok(host.hostState.error)
})
test('宿主上传原样传递，附件读取可返回Blob，不执行写入自动重试',async()=>{
 let writes=0;const form=new FormData(),blob=new Blob(['photo'])
 Object.assign(window,{handoverHost:{context:async()=>({userId:'person',applicationId:'app-a'}),request:async(_path:string,_method:string,body:unknown,options:{responseType?:string})=>{writes++;if(options.responseType==='blob')return blob;assert.equal(body,form);return {id:'file'}}}})
 await host.initializeHost();await host.hostRequest('/file/upload','POST',form);assert.equal(writes,1)
 assert.equal(await host.hostRequest('/authorize/me','GET',undefined,undefined,true),blob)
})
