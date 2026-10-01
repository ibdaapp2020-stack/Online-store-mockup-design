import { loadEnvFiles } from './load-env.mjs'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore'

loadEnvFiles(process.cwd())
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
await signInWithEmailAndPassword(auth, process.env.FIREBASE_ADMIN_EMAIL, process.env.FIREBASE_ADMIN_PASSWORD)

const categoryId = 'propharm-test-category'
const productId = 'propharm-test-product'
await setDoc(
  doc(db, 'categories', categoryId),
  {
    id: categoryId,
    name: 'PROPHARM_TEST_CATEGORY',
    blurb: 'TEST',
    sort: 999,
    active: true,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
)
await setDoc(
  doc(db, 'products', productId),
  {
    id: productId,
    name: 'PROPHARM_TEST_PRODUCT',
    category: categoryId,
    categoryId,
    price: 1,
    description: 'TEST',
    specs: [],
    stock: 1,
    rating: 5,
    reviews: 0,
    tone: '#0f766e',
    active: true,
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
)
const category = await getDoc(doc(db, 'categories', categoryId))
const product = await getDoc(doc(db, 'products', productId))
const named = await getDocs(query(collection(db, 'categories'), where('name', '==', 'PROPHARM_TEST_CATEGORY')))
console.log('TEST_CATEGORY', category.exists(), category.id, category.data()?.name)
console.log('TEST_PRODUCT', product.exists(), product.data()?.category, product.data()?.categoryId)
console.log('TEST_CATEGORY_DUP_COUNT', named.size)
const all = await getDocs(collection(db, 'categories'))
console.log('FS_CATEGORY_TOTAL', all.size)
process.exit(0)
