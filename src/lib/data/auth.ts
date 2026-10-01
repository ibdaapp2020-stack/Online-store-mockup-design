import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getFirebaseAuth } from '../firebase/config'
import { db } from './core'
import { firebaseMessage } from '../firebase/errors'

export type UserRole = 'ADMIN' | 'CUSTOMER' | 'STAFF'

export type AppUser = {
  uid: string
  email: string
  role: UserRole
}

function mapLogin(login: string) {
  const value = login.trim()
  if (value.includes('@')) return value
  if (value.toLowerCase() === 'propharm') return 'propharm2026@gmail.com'
  return `${value}@propharm.shop`
}

export function currentUser() {
  return getFirebaseAuth().currentUser
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

export async function getRole(uid: string): Promise<UserRole | null> {
  try {
    const snap = await getDoc(doc(db(), 'users', uid))
    const role = snap.data()?.role
    return role === 'ADMIN' || role === 'STAFF' || role === 'CUSTOMER' ? role : null
  } catch {
    return null
  }
}

export async function requireAdmin() {
  const user = currentUser()
  if (!user) throw new Error('נדרשת כניסת ניהול')
  const role = await getRole(user.uid)
  if (role !== 'ADMIN') throw new Error('אין הרשאת מנהל')
  return user
}

export async function loginAdmin(login: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), mapLogin(login), password)
    return { user: credential.user, role: await getRole(credential.user.uid) }
  } catch (error) {
    throw new Error(firebaseMessage(error, 'האימייל או הסיסמה שגויים'))
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), mapLogin(email))
  } catch (error) {
    throw new Error(firebaseMessage(error, 'לא ניתן לשלוח קישור לאיפוס סיסמה'))
  }
}

export async function logoutAuth() {
  await signOut(getFirebaseAuth())
}

export async function loginAccount(login: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), mapLogin(login), password)
    const role = (await getRole(credential.user.uid)) || 'CUSTOMER'
    return { user: credential.user, role }
  } catch (error) {
    throw new Error(firebaseMessage(error, 'הכניסה נכשלה'))
  }
}

export async function registerCustomer(input: { email: string; password: string; name: string; phone: string; city?: string; address?: string; birthday?: string }) {
  const email = mapLogin(String(input.email || input.phone || ''))
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, input.password)
  await setDoc(doc(db(), 'users', credential.user.uid), {
    role: 'CUSTOMER',
    email,
    createdAt: new Date().toISOString(),
  })
  await setDoc(doc(db(), 'customers', credential.user.uid), {
    id: credential.user.uid,
    name: input.name,
    phone: input.phone,
    email,
    birthday: input.birthday || '',
    city: input.city || '',
    address: input.address || '',
    points: 0,
    nextPercent: 0,
    couponCode: '',
    couponPercent: 0,
  })
  return credential.user
}
