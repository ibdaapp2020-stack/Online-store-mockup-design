import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

export type FirebaseEnvError = { missing: string[] }

export function missingFirebaseEnv(): string[] {
  return REQUIRED.filter((key) => !String(import.meta.env[key] || '').trim())
}

export function firebaseEnvError(): FirebaseEnvError | null {
  const missing = missingFirebaseEnv()
  return missing.length ? { missing } : null
}

function readConfig() {
  const missing = missingFirebaseEnv()
  if (missing.length) {
    throw new Error(`FIREBASE_CONFIG_MISSING:\n${missing.join('\n')}`)
  }
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  }
}

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let storage: FirebaseStorage | undefined

export function getFirebaseApp() {
  if (!app) {
    app = getApps()[0] ?? initializeApp(readConfig())
  }
  return app
}

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseApp())
    void setPersistence(auth, browserLocalPersistence)
  }
  return auth
}

export function getFirebaseDb() {
  if (!db) db = getFirestore(getFirebaseApp())
  return db
}

export function getFirebaseStorage() {
  if (!storage) storage = getStorage(getFirebaseApp())
  return storage
}
