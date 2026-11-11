<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {useRouter} from 'vue-router'
import App from './App.vue'
import {clearSession,initializeConfig,state} from './services/session'
import {hosted,hostState,hostBack} from './services/host'
import {verifySession} from './services/auth'
import {initializeWorkspace,currentDirectory} from "./services/workspace"
const router=useRouter(),ready=ref(false),error=ref(''),generation=ref(0)
const hostError=computed(()=>hostState.error)
let attempt=0
async function start(){
 const current=++attempt;ready.value=false;error.value='';state.ready=false
 try{
  await initializeConfig()
  if(current!==attempt)return
  if(state.session){
   try{await verifySession()}catch(cause){if(hosted)throw cause;clearSession();error.value=cause instanceof Error?cause.message:'登录验证失败'}
  }
  if(state.session)await initializeWorkspace()
  if(current!==attempt)return
  state.ready=true;generation.value++;ready.value=true
  if(error.value){ready.value=false;return}
  if(!state.session)await router.replace('/login')
  else if(router.currentRoute.value.path==='/login')await router.replace('/')
 }catch(cause){if(current===attempt)error.value=!navigator.onLine?'当前离线，请联网恢复应用登录后再继续':cause instanceof Error?cause.message:'应用暂不可用'}
}
function expired(){if(hosted){ready.value=false;error.value='APP 登录已过期，请返回 APP'}else void router.replace('/login')}
watch(()=>state.session,(session,previous)=>{if(previous&&session!==previous)generation.value++})
watch(hostError,value=>{if(value){ready.value=false;error.value=value;currentDirectory.value=undefined;clearSession(false)}})
onMounted(()=>{void start();window.addEventListener('handover:session-expired',expired)})
onBeforeUnmount(()=>{attempt++;window.removeEventListener('handover:session-expired',expired)})
</script>
<template><main v-if="error||hostError" class="startup-state"><van-empty :description="error||hostError"><van-button type="primary" @click="start" native-type="button">重新加载</van-button><van-button v-if="hosted" block @click="hostBack" native-type="button">返回 APP</van-button></van-empty></main><van-loading v-else-if="!ready" vertical class="startup-state">正在连接应用</van-loading><App v-else :key="generation"/></template>
<style scoped>.startup-state{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:20px}.van-button+.van-button{margin-top:12px}</style>
