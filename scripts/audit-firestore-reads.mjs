import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore'
import { loadEnvFiles } from './load-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFiles(root)

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || ''
console.log(`PROJECT_ID=${projectId || 'MISSING'}`)
console.log(`VITE_FIREBASE_API_KEY=${process.env.VITE_FIREBASE_API_KEY ? 'present' : 'missing'}`)
console.log(`VITE_FIREBASE_AUTH_DOMAIN=${process.env.VITE_FIREBASE_AUTH_DOMAIN ? 'present' : 'missing'}`)
console.log(`VITE_FIREBASE_STORAGE_BUCKET=${process.env.VITE_FIREBASE_STORAGE_BUCKET ? 'present' : 'missing'}`)
console.log(`VITE_FIREBASE_MESSAGING_SENDER_ID=${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? 'present' : 'missing'}`)
console.log(`VITE_FIREBASE_APP_ID=${process.env.VITE_FIREBASE_APP_ID ? 'present' : 'missing'}`)

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

async function probe(label, run) {
  try {
    const extra = await run()
    console.log(`${label}=OK${extra ? ` ${extra}` : ''}`)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    console.log(`${label}=FAIL code=${code || 'unknown'} message=${error instanceof Error ? error.message : 'error'}`)
  }
}

await probe('ANON_PRODUCTS_ACTIVE', async () => {
  const snap = await getDocs(query(collection(db, 'products'), where('active', '==', true)))
  return `count=${snap.size}`
})
await probe('ANON_PRODUCTS_ALL', async () => {
  const snap = await getDocs(collection(db, 'products'))
  return `count=${snap.size}`
})
await probe('ANON_CATEGORIES', async () => {
  const snap = await getDocs(collection(db, 'categories'))
  return `count=${snap.size}`
})
await probe('ANON_SETTINGS_STORE', async () => {
  const snap = await getDoc(doc(db, 'settings', 'store'))
  return `exists=${snap.exists()}`
})

const email = process.env.FIREBASE_ADMIN_EMAIL
const password = process.env.FIREBASE_ADMIN_PASSWORD
if (!email || !password) {
  console.log('AUTH_SKIP=missing FIREBASE_ADMIN_EMAIL or FIREBASE_ADMIN_PASSWORD names only')
  process.exit(0)
}

const auth = getAuth(app)
const cred = await signInWithEmailAndPassword(auth, email, password)
const uid = cred.user.uid
console.log(`AUTH_USER_FOUND=YES`)
console.log(`AUTH_UID=${uid}`)
console.log(`AUTH_EMAIL_MATCH=${String(cred.user.email || '').toLowerCase() === String(email).toLowerCase() ? 'YES' : 'NO'}`)

await probe('AUTH_USERS_DOC', async () => {
  const snap = await getDoc(doc(db, 'users', uid))
  const role = snap.data()?.role
  console.log(`USER_DOCUMENT_EXISTS=${snap.exists() ? 'YES' : 'NO'}`)
  console.log(`ROLE=${role === 'ADMIN' || role === 'STAFF' || role === 'CUSTOMER' ? role : snap.exists() ? 'OTHER' : 'MISSING'}`)
  return `exists=${snap.exists()}`
})
await probe('AUTH_PRODUCTS_ACTIVE', async () => {
  const snap = await getDocs(query(collection(db, 'products'), where('active', '==', true)))
  return `count=${snap.size}`
})
await probe('AUTH_PRODUCTS_ALL', async () => {
  const snap = await getDocs(collection(db, 'products'))
  return `count=${snap.size}`
})
