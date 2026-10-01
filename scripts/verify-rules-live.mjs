import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { loadEnvFiles } from './load-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFiles(root)

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)

async function probe(label, run) {
  try {
    const extra = await run()
    console.log(`${label}=OK${extra ? ` ${extra}` : ''}`)
    return true
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
    console.log(`${label}=FAIL code=${code || 'unknown'}`)
    return false
  }
}

console.log(`PROJECT=${process.env.VITE_FIREBASE_PROJECT_ID || 'MISSING'}`)

await probe('PUBLIC_PRODUCTS_ACTIVE', async () => `count=${(await getDocs(query(collection(db, 'products'), where('active', '==', true)))).size}`)
await probe('PUBLIC_CATEGORIES', async () => `count=${(await getDocs(collection(db, 'categories'))).size}`)
await probe('PUBLIC_SETTINGS_STORE', async () => `exists=${(await getDoc(doc(db, 'settings', 'store'))).exists()}`)
await probe('PUBLIC_USERS_LIST', async () => `count=${(await getDocs(collection(db, 'users'))).size}`)
await probe('PUBLIC_ORDERS_LIST', async () => `count=${(await getDocs(collection(db, 'orders'))).size}`)
await probe('PUBLIC_PRODUCT_WRITE', async () => {
  await updateDoc(doc(db, 'products', '__probe__'), { stock: 0 })
})
await probe('PUBLIC_COUNTER_WRITE', async () => {
  await setDoc(doc(db, 'settings', 'counters'), { lastOrder: 1 }, { merge: true })
})

const cred = await signInWithEmailAndPassword(getAuth(app), process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD)
const uid = cred.user.uid
console.log(`AUTH=YES`)
console.log(`UID=${uid}`)
const userSnap = await getDoc(doc(db, 'users', uid))
console.log(`USER_DOC=${userSnap.exists() ? 'FOUND' : 'MISSING'}`)
console.log(`ROLE=${userSnap.data()?.role || 'MISSING'}`)
await probe('ADMIN_PRODUCTS_ALL', async () => `count=${(await getDocs(collection(db, 'products'))).size}`)
await probe('ADMIN_ORDERS_LIST', async () => `count=${(await getDocs(collection(db, 'orders'))).size}`)
await probe('ADMIN_CATEGORIES', async () => `count=${(await getDocs(collection(db, 'categories'))).size}`)

process.exit(0)
