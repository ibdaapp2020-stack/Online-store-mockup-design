import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore'
import { loadEnvFiles } from './load-env.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFiles(root)

const email = process.env.FIREBASE_ADMIN_EMAIL
const password = process.env.FIREBASE_ADMIN_PASSWORD
if (!email || !password) {
  console.error('FIREBASE_ADMIN_EMAIL / FIREBASE_ADMIN_PASSWORD missing')
  process.exit(1)
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})
const auth = getAuth(app)
const firestore = getFirestore(app)

let created = false
try {
  await signInWithEmailAndPassword(auth, email, password)
} catch (signInError) {
  const code = signInError && typeof signInError === 'object' && 'code' in signInError ? String(signInError.code) : ''
  if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential' && code !== 'auth/invalid-login-credentials') {
    console.error(`AUTH_FAIL ${code || signInError}`)
    process.exit(1)
  }
  try {
    await createUserWithEmailAndPassword(auth, email, password)
    created = true
  } catch (createError) {
    const createCode = createError && typeof createError === 'object' && 'code' in createError ? String(createError.code) : ''
    console.error(`CREATE_FAIL ${createCode || createError}`)
    process.exit(1)
  }
}

const uid = auth.currentUser?.uid
if (!uid) {
  console.error('AUTH_FAIL no user')
  process.exit(1)
}
console.log(`ADMIN_EMAIL=${email}`)
console.log(`ADMIN_UID=${uid}`)

const userRef = doc(firestore, 'users', uid)
let role = null
try {
  const snap = await getDoc(userRef)
  role = snap.data()?.role || null
} catch (error) {
  console.error(`ROLE_READ_FAIL ${error instanceof Error ? error.message : error}`)
}

if (role !== 'ADMIN') {
  try {
    await setDoc(userRef, { role: 'ADMIN', email, createdAt: new Date().toISOString() }, { merge: true })
    role = 'ADMIN'
  } catch (error) {
    console.error(`ROLE_WRITE_FAIL ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}

console.log(`ADMIN_CREATED=${created ? 'YES' : 'NO'}`)
console.log(`ADMIN_ROLE=${role}`)
console.log(`ADMIN_ROLE_PASS=${role === 'ADMIN' ? 'PASS' : 'FAIL'}`)
