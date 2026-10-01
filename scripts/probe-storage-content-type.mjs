import { loadEnvFiles } from './load-env.mjs'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'

loadEnvFiles(process.cwd())
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const cred = await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD)
const user = cred.user
const userDoc = await getDoc(doc(db, 'users', user.uid))
console.log('PROJECT', process.env.VITE_FIREBASE_PROJECT_ID)
console.log('BUCKET', process.env.VITE_FIREBASE_STORAGE_BUCKET)
console.log('SIGNED_IN', Boolean(user))
console.log('UID', user.uid)
console.log('EMAIL', user.email)
console.log('EMAIL_VERIFIED', user.emailVerified)
console.log('USER_DOC', userDoc.exists())
console.log('ROLE', userDoc.data()?.role || '')

async function tryType(label, type) {
  const path = `products/item-muptf078/probe-${label}.png`
  try {
    const stored = ref(storage, path)
    await uploadBytes(stored, PNG, { contentType: type })
    const url = await getDownloadURL(stored)
    console.log('UPLOAD', label, 'PASS', Boolean(url))
  } catch (error) {
    console.log('UPLOAD', label, 'FAIL', error.code || error.message)
  }
}

await tryType('png', 'image/png')
await tryType('empty', '')
await tryType('octet', 'application/octet-stream')
await tryType('jpg', 'image/jpg')
process.exit(0)
