<script setup lang="ts">
defineProps<{modelValue?:string|number;options:{label:string;value:string|number}[]}>()
const emit=defineEmits<{'update:modelValue':[value:string|number]}>()
</script>
<template><van-tabs :active="modelValue" @update:active="emit('update:modelValue',$event)"><van-tab v-for="option in options" :key="option.value" :name="option.value" :title="option.label"/></van-tabs></template>
