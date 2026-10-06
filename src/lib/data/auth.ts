import { deleteApp, FirebaseError, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, inMemoryPersistence, onAuthStateChanged, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut, getAuth, type Auth, type User } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, setDoc } from 'firebase/firestore'
import { getFirebaseApp, getFirebaseAuth } from '../firebase/config'
import { db } from './core'
import { firebaseMessage } from '../firebase/errors'

export type UserRole = 'ADMIN' | 'CUSTOMER' | 'STAFF'

export type AppUser = {
  uid: string
  email: string
  role: UserRole
}

const OWNER_ADMIN_EMAIL = 'propharm2026@gmail.com'

function mapLogin(login: string) {
  const value = login.trim()
  if (value.includes('@')) return value
  if (value.toLowerCase() === 'propharm') return OWNER_ADMIN_EMAIL
  return `${value}@propharm.shop`
}

export async function resolveLoginEmail(login: string) {
  const value = login.trim()
  if (value.includes('@')) return value
  if (value.toLowerCase() === 'propharm') return OWNER_ADMIN_EMAIL
  const key = value.toLowerCase()
  try {
    const snap = await getDoc(doc(db(), 'logins', key))
    const email = snap.data()?.email
    if (typeof email === 'string' && email.includes('@')) return email
  } catch {
    // The public login map is optional until the access rules are published.
  }
  return `${key}@propharm.shop`
}

function authCode(error: unknown) {
  return error instanceof FirebaseError ? error.code : ''
}

export async function openStaffAccount(email: string, password: string) {
  const name = `staff-auth-${Date.now()}`
  const secondary = initializeApp(getFirebaseApp().options, name)
  const auth: Auth = getAuth(secondary)
  try {
    await setPersistence(auth, inMemoryPersistence)
    let created = false
    let credential
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password)
      created = true
    } catch (error) {
      if (authCode(error) !== 'auth/email-already-in-use') throw new Error(firebaseMessage(error, 'לא ניתן ליצור כניסה לעובד'))
      try {
        credential = await signInWithEmailAndPassword(auth, email, password)
      } catch {
        throw new Error('שם המשתמש תפוס')
      }
    }
    const uid = credential.user.uid
    if (created) {
      await setDoc(doc(getFirestore(secondary), 'users', uid), {
        role: 'CUSTOMER',
        email,
        createdAt: new Date().toISOString(),
      })
    } else {
      const role = (await getDoc(doc(getFirestore(secondary), 'users', uid))).data()?.role
      const customer = await getDoc(doc(getFirestore(secondary), 'customers', uid))
      if (role === 'ADMIN' || customer.exists()) throw new Error('שם המשתמש תפוס')
    }
    await signOut(auth)
    return uid
  } finally {
    await deleteApp(secondary)
  }
}

export function currentUser() {
  return getFirebaseAuth().currentUser
}

export function watchAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), callback)
}

function asRole(value: unknown): UserRole | null {
  return value === 'ADMIN' || value === 'STAFF' || value === 'CUSTOMER' ? value : null
}

export async function getRole(uid: string): Promise<UserRole | null> {
  try {
    const snap = await getDoc(doc(db(), 'users', uid))
    return asRole(snap.data()?.role)
  } catch {
    return null
  }
}

async function claimOwnerAdmin(user: User): Promise<UserRole | null> {
  const current = await getRole(user.uid)
  if (current === 'ADMIN') return current
  if (String(user.email || '').toLowerCase() !== OWNER_ADMIN_EMAIL) return current
  await setDoc(
    doc(db(), 'users', user.uid),
    { role: 'ADMIN', email: OWNER_ADMIN_EMAIL, createdAt: new Date().toISOString() },
    { merge: true },
  )
  return (await getRole(user.uid)) || 'ADMIN'
}

export async function requireAdmin() {
  const user = currentUser()
  if (!user) throw new Error('נדרשת כניסת ניהול')
  const role = (await claimOwnerAdmin(user)) || (await getRole(user.uid))
  if (role !== 'ADMIN') throw new Error('אין הרשאת מנהל')
  return user
}

export async function loginAdmin(login: string, password: string) {
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), await resolveLoginEmail(login), password)
    const role = await claimOwnerAdmin(credential.user)
    return { user: credential.user, role }
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
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), await resolveLoginEmail(login), password)
    const role = await getRole(credential.user.uid)
    if (role === 'ADMIN') return { user: credential.user, role }
    if (role === 'STAFF') {
      const employees = await getDocs(collection(db(), 'employees'))
      const mine = employees.docs.find((item) => item.data().authUid === credential.user.uid || item.id === credential.user.uid)
      if (!mine || mine.data().active === false) {
        await signOut(getFirebaseAuth())
        throw new Error('החשבון לא פעיל')
      }
      return { user: credential.user, role }
    }
    const customer = await getDoc(doc(db(), 'customers', credential.user.uid))
    if (!customer.exists()) {
      await signOut(getFirebaseAuth())
      throw new Error('החשבון לא פעיל')
    }
    return { user: credential.user, role: 'CUSTOMER' as const }
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
