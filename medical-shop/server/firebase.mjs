import { existsSync, readFileSync } from 'node:fs'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const TEST_PREFIX = 'staging_'

export function dataSource() {
  const value = String(process.env.DATA_SOURCE || 'sqlite').toLowerCase()
  if (value === 'firebase-live' || value === 'firebase') return 'firebase-live'
  if (value === 'firebase-test' || value === 'firebase_test') return 'firebase-test'
  return 'sqlite'
}

export function isFirebaseData() {
  return dataSource() !== 'sqlite'
}

export function collectionPrefix() {
  if (dataSource() === 'firebase-test') return process.env.FIREBASE_COLLECTION_PREFIX || TEST_PREFIX
  return process.env.FIREBASE_COLLECTION_PREFIX || ''
}

export function isEmulator() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
}

export function firebaseConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.FIRESTORE_EMULATOR_HOST ||
        process.env.FIREBASE_AUTH_EMULATOR_HOST),
  )
}

function credentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  }
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (file && existsSync(file)) return cert(JSON.parse(readFileSync(file, 'utf8')))
  if (isEmulator()) return undefined
  try {
    return applicationDefault()
  } catch {
    return undefined
  }
}

export function getFirebase() {
  if (!firebaseConfigured() && !isEmulator()) return null
  const projectId = process.env.FIREBASE_PROJECT_ID || 'pro-pharm-test'
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`
  const options = { projectId, storageBucket }
  const credential = credentials()
  if (credential) options.credential = credential
  const app = getApps()[0] || initializeApp(options)
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    bucket: getStorage(app).bucket(storageBucket),
    projectId,
    storageBucket,
  }
}

export function firebaseStatus() {
  return {
    configured: firebaseConfigured() || isEmulator(),
    dataSource: dataSource(),
    liveSwitched: dataSource() === 'firebase-live',
    emulator: isEmulator(),
    prefix: collectionPrefix(),
    projectId: process.env.FIREBASE_PROJECT_ID || null,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
    sqliteStillPrimary: dataSource() === 'sqlite',
  }
}
