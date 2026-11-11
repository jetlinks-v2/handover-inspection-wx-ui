<script setup lang="ts">
withDefaults(defineProps<{show?:boolean;title?:string;closable?:boolean;closeOnClickOverlay?:boolean}>(),{closable:true,closeOnClickOverlay:true})
const emit=defineEmits<{'update:show':[show:boolean];close:[]}>()
function update(show:boolean){emit('update:show',show);if(!show)emit('close')}
</script>
<template><van-popup :show="show" position="bottom" round teleport="body" safe-area-inset-bottom :closeable="closable" :close-on-click-overlay="closable&&closeOnClickOverlay" class="mobile-popup" @update:show="update"><h2 v-if="title" class="popup-title">{{title}}</h2><div class="popup-content"><slot/><div v-if="$slots.footer" class="popup-actions"><slot name="footer"/></div></div></van-popup></template>
