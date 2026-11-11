<script setup lang="ts">
import {computed,ref} from 'vue'
import dayjs from 'dayjs'
import type {Dayjs} from 'dayjs'
import MobilePopup from './MobilePopup.vue'
const props=defineProps<{modelValue?:Dayjs;showTime?:boolean;clearable?:boolean;disabled?:boolean;format?:string}>()
const emit=defineEmits<{'update:modelValue':[value:Dayjs|undefined]}>()
const open=ref(false),tab=ref(0),date=ref<string[]>([]),time=ref<string[]>([])
const minDate=new Date(1900,0,1),maxDate=new Date(2100,11,31)
const display=computed(()=>props.modelValue?.isValid()?props.modelValue.format(props.format||(props.showTime?'YYYY-MM-DD HH:mm':'YYYY-MM-DD')):'')
function begin(){if(props.disabled)return;const value=props.modelValue||dayjs();date.value=value.format('YYYY-MM-DD').split('-');time.value=value.format('HH:mm').split(':');tab.value=0;open.value=true}
function confirm(){const value=dayjs(date.value.join('-')+'T'+(props.showTime?time.value.join(':'):'00:00')+':00');if(!value.isValid())return;emit('update:modelValue',value);open.value=false}
</script>
<template><van-field readonly clickable :disabled="disabled" :model-value="display" placeholder="请选择日期" right-icon="calendar-o" @click="begin"/><MobilePopup v-model:show="open" title="选择日期"><van-tabs v-model:active="tab"><van-tab title="日期"><van-date-picker v-model="date" :min-date="minDate" :max-date="maxDate" :show-toolbar="false"/></van-tab><van-tab v-if="showTime" title="时间"><van-time-picker v-model="time" :show-toolbar="false"/></van-tab></van-tabs><div class="popup-actions"><van-button v-if="clearable!==false" block @click="emit('update:modelValue',undefined);open=false" native-type="button">清空</van-button><van-button type="primary" block @click="confirm" native-type="button">确定</van-button></div></MobilePopup></template>
