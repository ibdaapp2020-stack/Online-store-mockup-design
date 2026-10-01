import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage'
import { loadEnvFiles } from './load-env.mjs'

loadEnvFiles(process.cwd())

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
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
const path = `products/_verify-storage/probe.png`

function result(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` ${extra}` : ''}`)
}

async function tryUpload(label, bytes, contentType) {
  try {
    const stored = ref(storage, path)
    await uploadBytes(stored, bytes, { contentType })
    const url = await getDownloadURL(stored)
    result(label, true, 'url=yes')
    return url
  } catch (error) {
    const code = error?.code || ''
    result(label, false, code || error?.message || '')
    return null
  }
}

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp'])
function localValidate(type, size) {
  if (!allowed.has(type)) return 'type-blocked'
  if (size > 10 * 1024 * 1024) return 'size-blocked'
  return 'ok'
}
result('LOCAL invalid type', localValidate('text/html', 10) === 'type-blocked')
result('LOCAL oversized', localValidate('image/png', 11 * 1024 * 1024) === 'size-blocked')
result('LOCAL png ok', localValidate('image/png', 100) === 'ok')

const anon = await tryUpload('ANON upload', PNG, 'image/png')
result('ANON blocked', !anon)

const email = process.env.FIREBASE_ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
const password = process.env.FIREBASE_ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD
if (!email || !password) {
  console.log('FAIL AUTH missing admin env names (values not printed)')
  process.exit(1)
}

const cred = await signInWithEmailAndPassword(auth, email, password)
const uid = cred.user.uid
const userSnap = await getDoc(doc(db, 'users', uid))
result('AUTH', Boolean(uid))
result('USER DOC', userSnap.exists())
result('ROLE ADMIN', userSnap.data()?.role === 'ADMIN', `uid=${uid}`)

const url = await tryUpload('ADMIN png upload', PNG, 'image/png')
if (url) {
  result('getDownloadURL', true)
  try {
    await deleteObject(ref(storage, path))
    result('ADMIN delete test object', true)
  } catch (error) {
    result('ADMIN delete test object', false, error?.code || '')
  }
} else {
  result('getDownloadURL', false)
}

await signOut(auth)
process.exit(0)
