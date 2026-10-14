import { adminFetch } from '../api'

export const PLACEHOLDER_IMAGE = '/products/placeholder.svg'

export async function uploadImages(files: File[]) {
  if (!files.length) return [] as string[]
  const body = new FormData()
  for (const file of files) body.append('files', file)
  const data = await adminFetch<{ urls: string[] }>('/api/admin/uploads', { method: 'POST', body })
  return data.urls
}

export function imageSrc(url?: string) {
  return url || PLACEHOLDER_IMAGE
}
