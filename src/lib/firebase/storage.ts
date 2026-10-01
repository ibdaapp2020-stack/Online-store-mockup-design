import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { getFirebaseAuth, getFirebaseStorage } from './config'
import { productImageErrorView, sanitizeImageName, validateProductImageFile } from '../image-errors'

export { getFirebaseStorage as storage, getFirebaseStorage }

export function productImagePath(productId: string, fileName: string) {
  return `products/${productId}/${sanitizeImageName(fileName)}`
}

export async function uploadProductImage(path: string, file: File) {
  validateProductImageFile(file)
  const user = getFirebaseAuth().currentUser
  if (import.meta.env.DEV) {
    console.info('product image upload', { uid: user?.uid || null, email: user?.email || null, path })
  }
  if (!user) {
    console.error('product image upload: not signed in')
    throw Object.assign(new Error(productImageErrorView({ code: 'auth' }).message), { code: 'auth' })
  }
  try {
    const stored = ref(getFirebaseStorage(), path)
    await uploadBytes(stored, file, { contentType: file.type })
    return await getDownloadURL(stored)
  } catch (reason) {
    console.error('product image upload failed', reason)
    throw Object.assign(new Error(productImageErrorView(reason).message), { code: 'storage/upload' })
  }
}

export async function deleteProductImage(path: string) {
  const user = getFirebaseAuth().currentUser
  if (!user) throw Object.assign(new Error(productImageErrorView({ code: 'auth' }).message), { code: 'auth' })
  try {
    await deleteObject(ref(getFirebaseStorage(), path))
  } catch (reason) {
    console.error('product image delete failed', reason)
    throw Object.assign(new Error(productImageErrorView(reason).message), { code: 'storage/delete' })
  }
}
