import {chromium} from 'playwright'
import {spawn} from 'node:child_process'
import {createServer} from 'node:net'
import {mkdir} from 'node:fs/promises'
import assert from 'node:assert/strict'
const APP='handover',BASE='/handover-h5/'
const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve))
const origin=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'})
let browser,activePage;const artifacts='.agent-runtime/browser';await mkdir(artifacts,{recursive:true})
const room={projectId:'project',projectName:'测试项目',spaceId:'room',name:'101',fullName:'测试项目/1栋/101',customerName:'住户',nature:'owner'}
const order={id:'order',number:'R001',title:'门锁维修',description:'门锁维修',status:0,version:1,businessProjectId:'project',businessProjectName:'测试项目',categoryId:'category',categoryName:'维修',channelId:'channel',channelName:'自查',contactName:'员工',contactPhone:'13800000000',createTime:Date.now()}
const record={id:'record',projectId:'project',workOrderId:'order',taskId:'task',subjectParentId:'line',subjectParentName:'安全',subjectName:'消防',checkContentName:'消防箱完整',checkRequirement:'检查箱门与器材',photoRequirement:'现场照片',originalScore:10,executorId:'person',executorName:'员工',recordStatus:1}
const detail={workOrder:{id:'order',version:1,taskName:'每日核查',taskCode:'Q001',projectName:'测试项目',templateName:'安全检查',workOrderStatus:1,reportDeadline:Date.now(),scheduledTime:Date.now(),recordCount:1},records:[record],rectifications:[],history:[],draft:{},currentUserId:'person'}
const permissions=[{id:'repair-order',actions:['query','create','dispatch','accept']},{id:'handover-problem',actions:['query','save']},{id:'quality-work-order',actions:['query','inspect']}]
const user={user:{id:'person',name:'员工'},permissions}
const shots=[]
function response(path,request){
 if(path==='/authorize/login/configs')return {encrypt:{enabled:false}}
 if(path==='/authorize/captcha/config')return {enabled:false,type:'image'}
 if(path==='/authorize/login')return {token:'browser-fixture'}
 if(path==='/authorize/me')return user
 if(path==='/property/space/_projects'||path.endsWith('/directory/projects'))return [{id:'project',name:'测试项目',fullName:'测试项目'}]
 if(path.endsWith('/directory/me'))return {id:'person',employee:true,organizationIds:['org']}
 if(path.endsWith('/_counts'))return {total:0,review:0}
 if(path==='/repair/orders/order')return order
 if(path==='/quality/work-orders/order')return detail
 if(path==='/quality/context')return {userId:'person',actions:['query','inspect','rectify','review','transferRepair']}
 if(path.includes('/candidates'))return [{id:'person',name:'员工'}]
 if(path.endsWith('/rooms'))return [room]
 if(path.endsWith('/accounts'))return []
 if(path.endsWith('/_statistics'))return []
 if(path.endsWith('/_count'))return 0
 if(path.endsWith('/_query'))return {data:path==='/quality/work-orders/_query'?[detail.workOrder]:[],total:path==='/quality/work-orders/_query'?1:0}
 if(path.endsWith('/bills'))return {data:[{id:'bill',subjectName:'物业服务费',periodStart:'2026-11-01',periodEnd:'2026-11-30',dueDate:'2026-11-30',amount:'100.00',paidAmount:'0.00',arrears:'100.00',discount:'0.00',lateFee:'0.00'}],total:1,totalAmount:'100.00'}
 if(path.endsWith('/records')||path.endsWith('/entries'))return {data:[],total:0}
 return []
}
async function readyPage(width){
 const page=await browser.newPage({viewport:{width,height:844}});page.setDefaultTimeout(6000)
 activePage=page;const errors=[],calls=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/Failed to resolve component|Unhandled error|Duplicate attribute/.test(message.text()))errors.push(message.text())})
 await page.route(origin+'/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname.slice(4);calls.push({path,method:req.method()});const headers=req.headers();assert.equal(headers['x-tenant-domain'],undefined);if(path.startsWith('/authorize/')&&path!='/authorize/me'){assert.equal(headers['x-access-token'],undefined);assert.equal(headers['x-asset-scope'],undefined)}await route.fulfill({json:{status:200,result:response(path,req)}})})
 return {page,errors,calls}
}
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow')}
async function snap(page,label,width){const path=`${artifacts}/${APP}-${label}-${width}.png`;await page.screenshot({path,fullPage:true});shots.push(path)}
try{
 for(let attempt=0;attempt<100;attempt++){try{if((await fetch(origin+BASE)).ok)break}catch{}await new Promise(resolve=>setTimeout(resolve,100));if(attempt===99)throw Error('preview failed to start')}
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true})
 for(const width of [320,390]){
  const {page,errors,calls}=await readyPage(width)
  await page.goto(origin+BASE+'?applicationScope=app-a');await page.locator('input[autocomplete=username]').waitFor();assert.equal(await page.getByText('项目编码',{exact:true}).count(),0)
  await snap(page,'login',width);await noOverflow(page)
  await page.getByRole('button',{name:'登录',exact:true}).click();assert.equal(calls.filter(call=>call.path==='/authorize/login').length,0)
  await page.locator('input[autocomplete=username]').fill('worker@suffix');await page.locator('input[autocomplete=current-password]').fill('fixture-password')
  await page.getByRole('button',{name:'登录',exact:true}).click();await page.locator('input[autocomplete=username]').waitFor({state:'detached'});await page.waitForTimeout(150)
  await snap(page,'home',width);await noOverflow(page)
  if(APP==='repair'){
   await page.locator('.date-row').click();await page.locator('.mobile-popup:visible').first().locator('input[placeholder="请选择日期"]').first().click();await page.locator('.van-picker').waitFor();await page.locator('.mobile-popup:visible').last().getByRole('button',{name:'确定',exact:true}).click();await page.locator('.mobile-popup:visible').first().getByRole('button',{name:'确定',exact:true}).click()
   await page.goto(origin+BASE+'?applicationScope=app-a#/create');await page.getByText('报事信息',{exact:true}).waitFor();await page.locator('input[placeholder="请选择业务项目"]').click();await page.locator('.selection-options').getByText('测试项目',{exact:true}).click();await page.locator('.mobile-popup:visible').last().getByRole('button',{name:'确定',exact:true}).click();assert.equal(await page.locator('input[placeholder="请选择业务项目"]').inputValue(),'测试项目')
   await page.getByRole('button',{name:'提交报事',exact:true}).click();assert.equal(calls.some(call=>call.path==='/repair/orders'&&call.method==='POST'),false)
  }else if(APP==='quality'){
   await page.goto(origin+BASE+'?applicationScope=app-a#/orders/order');await page.getByText('每日核查',{exact:true}).waitFor();const start=page.getByRole('button',{name:/开始核查/});await start.click();await page.locator('.mobile-popup:visible').waitFor();await page.locator('.mobile-popup:visible').getByText('消防箱完整',{exact:true}).waitFor();await page.locator('.mobile-popup:visible').getByRole('button',{name:'取消',exact:true}).click()
  }else if(APP==='handover'){
   await page.locator('input[placeholder="选择有权限的项目"]').click();await page.locator('.selection-options').getByText('测试项目',{exact:true}).click();await page.getByRole('button',{name:'确定',exact:true}).click();await page.getByRole('button',{name:/录入现场/}).waitFor();await page.getByRole('button',{name:/录入现场/}).click();await page.getByText('问题描述',{exact:true}).waitFor()
  }else{
   await page.goto(origin+BASE+'?applicationScope=app-a#/bills');await page.getByText('物业服务费',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes('100.00'))
  }
  await snap(page,'business',width);await noOverflow(page);assert.deepEqual(errors,[])
  await page.reload();await page.waitForTimeout(200);assert.equal(await page.locator('input[autocomplete=username]').count(),0)
  await page.goto(origin+BASE+'?applicationScope=app-b');await page.locator('input[autocomplete=username]').waitFor()
  await page.close();console.log(APP,width,'login, validation, refresh, business controls and layout passed')
 }
 {
  const {page,errors}=await readyPage(390);await page.goto(origin+BASE);await page.getByText('请从具体应用入口打开此页面',{exact:true}).waitFor();assert.equal(await page.locator('input[autocomplete=username]').count(),0)
  await page.goto(origin+BASE+'?mode=app');await page.getByText(/APP 上下文尚未就绪/).waitFor();assert.equal(await page.locator('input[autocomplete=username]').count(),0);await page.close();assert.deepEqual(errors,[])
 }
 {
  const {page,errors,calls}=await readyPage(390)
  await page.addInitScript(({user,room})=>{
   let changed=false;window.__changeHost=()=>{changed=true}
   window.handoverHost={context:async()=>{await new Promise(resolve=>setTimeout(resolve,80));return {userId:changed?'other':'person',applicationId:'app-a',environmentId:'fixture',permissions:user.permissions}},request:async path=>path==='/authorize/me'?user:path.endsWith('/rooms')?[room]:path.endsWith('/_query')?{data:[],total:0}:path.endsWith('/_count')?0:[],back:()=>{window.__backCalled=true}}
  },{user,room})
  await page.goto(origin+BASE+'?mode=app&applicationScope=app-a');await page.waitForTimeout(400);assert.equal(await page.locator('input[autocomplete=username]').count(),0);assert.equal(calls.length,0);assert.deepEqual(errors,[]);await page.close()
 }
 {
  const {page}=await readyPage(390);await page.goto(origin+BASE+'?applicationScope=app-a');await page.locator('input[autocomplete=username]').waitFor()
  await page.evaluate(()=>navigator.serviceWorker.ready)
  const cached=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys())for(const request of await (await caches.open(name)).keys())result.push(new URL(request.url).pathname);return result})
  assert.ok(cached.includes(BASE+'index.html'));assert.ok(cached.every(path=>path.startsWith(BASE)&&!path.endsWith('config.json')&&!path.includes('/api/')))
  await page.context().setOffline(true);await page.reload();await page.getByText('当前离线，请联网恢复应用登录后再继续',{exact:true}).waitFor();assert.equal(await page.locator('input[autocomplete=username]').count(),0);await page.close()
 }
 console.log(APP,'browser checks passed; static offline shell excludes config and API; screenshots:',shots.length)
}catch(error){await activePage?.screenshot({path:`${artifacts}/${APP}-failure.png`,fullPage:true}).catch(()=>{});throw error}finally{await browser?.close();server.kill('SIGTERM')}
