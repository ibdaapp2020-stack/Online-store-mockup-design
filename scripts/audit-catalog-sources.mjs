import { loadEnvFiles } from './load-env.mjs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, getDocs, getFirestore } from 'firebase/firestore'

loadEnvFiles(process.cwd())
const sqlite = new DatabaseSync(join(process.cwd(), 'data', 'shop.db'), { readOnly: true })
const cats = sqlite.prepare('SELECT id, name FROM categories ORDER BY sort').all()
const prods = sqlite.prepare('SELECT category, COUNT(*) AS c FROM products GROUP BY category').all()
console.log('SQLITE_CATS', cats.length)
for (const row of cats) console.log('SQLITE_CAT', row.id, row.name)
console.log('SQLITE_PROD_CATS')
for (const row of prods) console.log(row.category, row.c)
const names = cats.map((row) => row.name)
const dups = names.filter((name, index) => names.indexOf(name) !== index)
console.log('SQLITE_DUP_NAMES', [...new Set(dups)])

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})
const db = getFirestore(app)
const auth = getAuth(app)
await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD)
const fc = await getDocs(collection(db, 'categories'))
const fp = await getDocs(collection(db, 'products'))
console.log('FS_CATS', fc.size, 'FS_PRODS', fp.size)
const fsNames = []
for (const item of fc.docs) {
  const data = item.data()
  fsNames.push(String(data.name || ''))
  console.log('FS_CAT', item.id, data.name, 'active', data.active)
}
console.log('FS_DUP_NAMES', [...new Set(fsNames.filter((name) => fsNames.filter((item) => item === name).length > 1))])
const pcat = {}
for (const item of fp.docs) {
  const key = String(item.data().category || '')
  pcat[key] = (pcat[key] || 0) + 1
}
console.log('FS_PROD_CATEGORY_VALUES', pcat)
sqlite.close()
process.exit(0)
