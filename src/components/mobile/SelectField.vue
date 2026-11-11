<script setup lang="ts" generic="T = unknown">
import {computed,ref,watch} from 'vue'
import {selectionRows,type Choice,type Option} from './selection'
import MobilePopup from './MobilePopup.vue'
const props=withDefaults(defineProps<{modelValue?:T;options?:Option[];multiple?:boolean;tree?:boolean;changeOnSelect?:boolean;clearable?:boolean;disabled?:boolean;loading?:boolean;placeholder?:string;filterOption?:boolean}>(),{options:()=>[],placeholder:'请选择',filterOption:true})
const emit=defineEmits<{'update:modelValue':[value:T];change:[value:T];search:[text:string]}>()
const open=ref(false),keyword=ref(''),chosen=ref<Choice[]>([])
const rows=computed(()=>selectionRows(props.options,props.tree,props.changeOnSelect))
const filtered=computed(()=>props.filterOption===false?rows.value:rows.value.filter(row=>row.label.toLowerCase().includes(keyword.value.toLowerCase())))
const selected=computed<unknown[]>(()=>Array.isArray(props.modelValue)?props.modelValue:[props.modelValue])
const text=computed(()=>rows.value.filter(row=>selected.value.includes(row.value)&&(!props.tree||row.value===selected.value.at(-1))).map(row=>row.label.trim()).join('、'))
function begin(){if(props.disabled)return;keyword.value='';chosen.value=props.multiple?[...selected.value] as Choice[]:props.tree?[selected.value.at(-1)] as Choice[]:[props.modelValue] as Choice[];open.value=true}
function select(value:Choice,disabled?:boolean){if(disabled)return;if(props.multiple){chosen.value=chosen.value.includes(value)?chosen.value.filter(item=>item!==value):[...chosen.value,value]}else chosen.value=[value]}
function confirm(){const row=rows.value.find(row=>row.value===chosen.value[0]);const value=props.multiple?chosen.value:props.tree?(row?.path||[]):chosen.value[0];emit('update:modelValue',value as T);emit('change',value as T);open.value=false}
function clear(){const value=props.multiple||props.tree?[]:undefined;chosen.value=[];emit('update:modelValue',value as T);emit('change',value as T);open.value=false}
watch(keyword,text=>emit('search',text))
</script>
<template><van-field readonly clickable :model-value="text" :placeholder="placeholder" :disabled="disabled" right-icon="arrow-down" @click="begin"/><MobilePopup v-model:show="open" :title="placeholder"><van-search v-model="keyword" placeholder="搜索"/><van-loading v-if="loading" vertical>加载中</van-loading><div class="selection-options"><van-cell v-for="row in filtered" :key="String(row.value)" :title="row.label" :class="{'option-disabled':row.disabled}" clickable @click="select(row.value,row.disabled)"><template #right-icon><van-checkbox v-if="multiple" :model-value="chosen.includes(row.value)" :disabled="row.disabled" @click.stop="select(row.value,row.disabled)"/><van-icon v-else-if="chosen.includes(row.value)" name="success"/></template></van-cell><van-empty v-if="!filtered.length&&!loading" description="没有匹配选项"/></div><div class="popup-actions"><van-button v-if="clearable" block @click="clear" native-type="button">清空</van-button><van-button type="primary" block @click="confirm" native-type="button">确定</van-button></div></MobilePopup></template>
