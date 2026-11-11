<script setup lang="ts">
import {computed,inject} from 'vue'
import {formContext,fieldRules,type Rule} from './formContext'
const props=defineProps<{name?:string|string[];label?:string;rules?:Rule[];required?:boolean}>()
const form=inject(formContext,undefined)
const path=computed(()=>Array.isArray(props.name)?props.name:props.name?.split('.')||[])
const value=computed(()=>path.value.reduce<unknown>((value,key)=>(value as Record<string,unknown>|undefined)?.[key],form?.model.value))
const rules=computed(()=>fieldRules(props.rules||form?.rules.value[path.value.join('.')]||[],props.required,props.label,()=>value.value))
</script>
<template><van-field class="business-field" :label="label" :name="path.join('.')" :model-value="value===undefined?undefined:String(value)" :rules="rules" :required="required" :disabled="form?.disabled.value"><template #input><div class="field-control"><slot /></div></template></van-field></template>
