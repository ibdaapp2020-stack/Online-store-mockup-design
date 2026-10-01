const TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024

export function imageContentType(file: File) {
  const type = String(file.type || '').toLowerCase()
  if (type === 'image/jpg') return 'image/jpeg'
  if (type.startsWith('image/')) return type
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return TYPE_BY_EXT[ext] || ''
}

export type ImageErrorView = {
  title: string
  message: string
}

export function validateProductImageFile(file: File) {
  if (!imageContentType(file)) {
    throw Object.assign(new Error('ניתן להעלות קובץ תמונה בלבד.'), { code: 'image/type' })
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw Object.assign(new Error('התמונה גדולה מדי. ניתן להעלות תמונה עד 10MB.'), { code: 'image/size' })
  }
}

export function productImageErrorView(reason: unknown): ImageErrorView {
  const text = reason instanceof Error ? reason.message : String(reason || '')
  const code = reason && typeof reason === 'object' && 'code' in reason ? String((reason as { code?: string }).code || '') : ''
  const lower = `${code} ${text}`.toLowerCase()

  if (lower.includes('image/type') || lower.includes('קובץ תמונה') || lower.includes('קובצי תמונה') || lower.includes('לא נתמך')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'ניתן להעלות קובץ תמונה בלבד.' }
  }
  if (lower.includes('image/size') || lower.includes('גדולה מדי') || lower.includes('10mb') || lower.includes('too large')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'התמונה גדולה מדי. ניתן להעלות עד 10MB.' }
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'לא הצלחנו להתחבר לשירות התמונות. נסו שוב.' }
  }
  if (lower.includes('unauthorized') || lower.includes('permission') || lower.includes('unauthenticated') || code === 'auth') {
    return {
      title: 'לא הצלחנו להעלות את התמונה',
      message: 'אין הרשאה להעלות תמונות כרגע.\nיש לבדוק את הרשאות האחסון של מנהל המערכת.',
    }
  }
  if (lower.includes('object-not-found')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'הקובץ לא נמצא.' }
  }
  if (lower.includes('quota')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'לא ניתן להעלות כרגע את התמונה. מכסת האחסון נוצלה.' }
  }
  return { title: 'לא הצלחנו להעלות את התמונה', message: 'לא הצלחנו להעלות את התמונה. נסו שוב בעוד מספר רגעים.' }
}

export function sanitizeImageName(name: string) {
  const base = name.split(/[/\\]/).pop() || 'image'
  const safe = base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return safe || 'image.png'
}
