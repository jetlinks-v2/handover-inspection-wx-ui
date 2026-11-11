<script setup lang="ts">
import {reactive} from 'vue'
import {useRouter} from 'vue-router'
import {useSession} from '../hooks/useSession'
import {initializeWorkspace} from '../services/workspace'
import LoginVerification from '../components/LoginVerification.vue'
const vm=reactive(useSession()),router=useRouter()
async function login(){await vm.login();if(!vm.error){await initializeWorkspace();await router.replace('/')}}
</script>
<template><section class="login-page"><h1>承接查验</h1><p>使用应用账号登录</p><div class="panel"><MobileNotice v-if="vm.error" :message="vm.error" type="error"/><BusinessForm :model="vm.form" @submit="login"><BusinessField label="应用账号" name="username" :rules="[{required:true,message:'请输入应用账号'}]"><van-field v-model="vm.form.username" autocomplete="username" :disabled="vm.loading"/></BusinessField><BusinessField label="密码" name="password" :rules="[{required:true,message:'请输入密码'}]"><van-field v-model="vm.form.password" type="password" autocomplete="current-password" :disabled="vm.loading"/></BusinessField><van-button type="primary" native-type="submit" block :loading="vm.loading">登录</van-button></BusinessForm></div><LoginVerification v-if="vm.verification" :requirement="vm.verification" @success="vm.completeVerification" @cancel="vm.cancelVerification"/></section></template>
