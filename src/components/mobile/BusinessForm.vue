<script setup lang="ts">
import {computed,provide,ref} from 'vue'
import type {FormInstance} from 'vant'
import {formContext} from './formContext'
const props=withDefaults(defineProps<{model?:object;rules?:object;disabled?:boolean}>(),{model:()=>({}),rules:()=>({})})
const emit=defineEmits<{submit:[values:Record<string,unknown>]}>()
const form=ref<FormInstance>()
provide(formContext,{model:computed(()=>props.model as Record<string,unknown>),rules:computed(()=>props.rules as Record<string,Rule[]>),disabled:computed(()=>props.disabled)})
import type {Rule} from './formContext'
defineExpose({validate:()=>form.value!.validate(),resetValidation:()=>form.value?.resetValidation()})
</script>
<template><van-form ref="form" label-align="top" scroll-to-error :disabled="disabled" @submit="emit('submit',$event)"><slot /></van-form></template>
