export async function preparePhoto(file: File, watermark: string): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw Error('请选择照片文件')
  if (file.size > 30 * 1024 * 1024) throw Error('单张照片不能超过 30 MB')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw Error('浏览器不支持图片处理，请更换浏览器')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    if (watermark) {
      const size = Math.max(15, Math.round(canvas.width / 42))
      context.font = `${size}px sans-serif`
      const lines = watermark.split('\n')
      const height = (lines.length + 1) * size * 1.5
      context.fillStyle = 'rgba(0,0,0,.68)'
      context.fillRect(0, canvas.height - height, canvas.width, height)
      context.fillStyle = '#fff'
      lines.forEach((line, index) =>
        context.fillText(line, 16, canvas.height - height + (index + 1) * size * 1.5, canvas.width - 32)
      )
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(Error('图片处理失败'))), 'image/jpeg', 0.85)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
export async function locate() {
  if (!window.isSecureContext) throw Error('定位需要 HTTPS 或 localhost')
  if (!navigator.geolocation) throw Error('当前浏览器不支持定位')
  return new Promise<string>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve(
          `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} · ±${Math.round(position.coords.accuracy)}m`
        ),
      (error) =>
        reject(Error(error.code === 1 ? '定位权限已拒绝，可手动填写位置' : '定位失败，请重试或手动填写位置')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  )
}
