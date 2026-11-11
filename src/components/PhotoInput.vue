<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue'
import { CameraOutlined, PictureOutlined, DeleteOutlined } from '../components/mobile/icons'
import { preparePhoto, locate } from '../services/media'
import { state } from '../services/session'
import { errorText } from '../services/labels'
import type { Photo } from '../types'
const props = defineProps<{ modelValue: Photo[]; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Photo[]] }>()
const error = ref(''),
  busy = ref(false),
  watermark = ref(true),
  position = ref(''),
  urls = ref<Record<string, string>>({})
watch(
  () => props.modelValue,
  (photos) => {
    for (const [id, url] of Object.entries(urls.value))
      if (!photos.some((p) => p.id === id)) {
        URL.revokeObjectURL(url)
        delete urls.value[id]
      }
    for (const photo of photos)
      if (!urls.value[photo.id]) urls.value[photo.id] = URL.createObjectURL(photo.blob)
  },
  { immediate: true, deep: true }
)
onBeforeUnmount(() => Object.values(urls.value).forEach(URL.revokeObjectURL))
async function select(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  busy.value = true
  error.value = ''
  try {
    if (props.modelValue.length + files.length > 20) throw Error('最多添加 20 张照片')
    const added: Photo[] = []
    for (const file of files) {
      const text = watermark.value
        ? [state.authorization?.user.name || '查验人员', new Date().toLocaleString('zh-CN'), position.value]
            .filter(Boolean)
            .join('\n')
        : ''
      added.push({
        id: crypto.randomUUID(),
        blob: await preparePhoto(file, text),
        name: file.name.replace(/\.[^.]+$/, '') + '.jpg'
      })
    }
    emit('update:modelValue', [...props.modelValue, ...added])
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    busy.value = false
    input.value = ''
  }
}
async function location() {
  try {
    position.value = await locate()
    error.value = ''
  } catch (cause) {
    error.value = errorText(cause)
  }
}
</script>
<template>
  <div class="photo-input">
    <div class="photo-grid">
      <div
        v-for="photo in modelValue"
        :key="photo.id"
        class="photo-thumb"
      >
        <a
          :href="urls[photo.id]"
          target="_blank"
          rel="noopener"
        >
          <img
            :src="urls[photo.id]"
            :alt="photo.name"
          />
        </a>
        <button
          v-if="!disabled"
          type="button"
          :aria-label="'移除 ' + photo.name"
          @click="
            emit(
              'update:modelValue',
              modelValue.filter((p) => p.id !== photo.id)
            )
          "
        >
          <DeleteOutlined />
        </button>
      </div>
    </div>
    <template v-if="!disabled">
      <div class="row">
        <label class="upload-control">
          <CameraOutlined />
          拍照
          <input
            type="file"
            accept="image/*"
            capture="environment"
            :disabled="busy"
            @change="select"
          />
        </label>
        <label class="upload-control">
          <PictureOutlined />
          选照片
          <input
            type="file"
            accept="image/*"
            multiple
            :disabled="busy"
            @change="select"
          />
        </label>
      </div>
      <div class="row">
        <van-checkbox v-model:checked="watermark">时间及人员水印</van-checkbox>
        <van-button
          text="" plain
          :disabled="busy"
          @click="location"
         native-type="button">
          获取定位水印
        </van-button>
      </div>
      <p
        v-if="position"
        class="muted"
      >
        {{ position }}
      </p>
      <p class="hint">拍照由浏览器调用系统相机；拒绝相机权限后可选择相册。水印记录添加照片时的信息。</p>
    </template>
    <MobileNotice
      v-if="busy"
      message="正在处理照片，请稍候"
      type="info"
    />
    <MobileNotice
      v-if="error"
      :message="error"
      type="error"
      show-icon
    />
  </div>
</template>
