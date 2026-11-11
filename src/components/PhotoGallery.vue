<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import type { FileRef } from '../types'
import { fileBlob } from '../api/http'
import { errorText } from '../services/labels'
defineProps<{ photos: FileRef[] }>()
const preview = ref(''),
  busy = ref(''),
  error = ref('')
function close() {
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
}
async function open(photo: FileRef) {
  busy.value = photo.fileId
  error.value = ''
  try {
    const blob = await fileBlob(photo.fileId)
    if (!blob.type.startsWith('image/')) throw Error('此附件不是可预览照片')
    close()
    preview.value = URL.createObjectURL(blob)
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    busy.value = ''
  }
}
onBeforeUnmount(close)
</script>
<template>
  <div class="photo-files">
    <van-button
      v-for="(photo, index) in photos"
      :key="photo.fileId"
      :loading="busy === photo.fileId"
      @click="open(photo)"
     native-type="button">
      {{ photo.photoType === 'rectification' ? '整改照片' : '问题照片' }} {{ index + 1 }}
    </van-button>
    <p
      v-if="!photos.length"
      class="muted"
    >
      暂无照片
    </p>
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
    />
    <MobilePopup
      :show="!!preview"
      title="照片预览"
     
      @close="close"
    >
      <img
        class="preview-image"
        :src="preview"
        alt="查验照片原图"
      />
    </MobilePopup>
  </div>
</template>
