import {createApp,watch} from 'vue'
import {createRouter,createWebHashHistory} from 'vue-router'
import 'vant/lib/index.css'
import './style.css'
import './components/mobile/mobile.css'
import Root from './Root.vue'
import {state} from './services/session'
import {hosted,hostState} from './services/host'
import {installMobile} from './components/mobile/install'
export const router=createRouter({history:createWebHashHistory(),routes:[
{path:'/',component:()=>import('./views/HomePage.vue')},
{path:'/login',component:()=>import('./views/LoginPage.vue')},
{path:'/create',component:()=>import('./views/CreatePage.vue')},
{path:'/problems/:view(property|construction)',component:()=>import('./views/ProblemListPage.vue')},
{path:'/problem/:id',component:()=>import('./views/ProblemDetailPage.vue')},
{path:'/offline',component:()=>import('./views/OfflinePage.vue')},
{path:'/:pathMatch(.*)*',redirect:'/'}]})
router.beforeEach(to=>{
 if(!state.ready)return true
 if(hosted&&hostState.error)return false
 if(hosted&&to.path==='/login')return '/'
 if(to.path!=='/login'&&!state.session)return '/login'
 if(to.path!=='/'&&to.path!=='/login'&&!state.projectId)return '/'
 return true
})
const app=createApp(Root);installMobile(app);app.use(router).mount('#app')

// 仅缓存当前部署路径的静态壳；配置、API、照片和认证均不进入 Service Worker 缓存。
if(import.meta.env.PROD&&'serviceWorker' in navigator&&window.isSecureContext)
 void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL}).catch(()=>window.dispatchEvent(new Event('handover:offline-shell-failed')))
