const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024

export type ImageErrorView = {
  title: string
  message: string
}

export function validateProductImageFile(file: File) {
  if (!ALLOWED.has(file.type)) {
    throw Object.assign(new Error('ניתן להעלות תמונות JPG, PNG או WEBP בלבד.'), { code: 'image/type' })
  }
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
    throw Object.assign(new Error('התמונה גדולה מדי. ניתן להעלות קובץ עד 10MB.'), { code: 'image/size' })
  }
}

export function productImageErrorView(reason: unknown): ImageErrorView {
  const text = reason instanceof Error ? reason.message : String(reason || '')
  const code = reason && typeof reason === 'object' && 'code' in reason ? String((reason as { code?: string }).code || '') : ''
  const lower = `${code} ${text}`.toLowerCase()

  if (lower.includes('image/type') || lower.includes('jpg') || lower.includes('webp') || lower.includes('לא נתמך')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'ניתן להעלות תמונות JPG, PNG או WEBP בלבד.' }
  }
  if (lower.includes('image/size') || lower.includes('גדולה מדי') || lower.includes('10mb') || lower.includes('too large')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'התמונה גדולה מדי. ניתן להעלות קובץ עד 10MB.' }
  }
  if (lower.includes('auth') || lower.includes('not signed') || lower.includes('unauthenticated')) {
    return { title: 'לא הצלחנו להעלות את התמונה', message: 'לא ניתן היה להעלות את התמונה. נסו שוב בעוד מספר רגעים.' }
  }
  return { title: 'לא הצלחנו להעלות את התמונה', message: 'לא ניתן היה להעלות את התמונה. נסו שוב בעוד מספר רגעים.' }
}

export function sanitizeImageName(name: string) {
  const base = name.split(/[/\\]/).pop() || 'image'
  const safe = base.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return safe || 'image.png'
}
