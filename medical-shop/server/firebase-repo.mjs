import { randomBytes } from 'node:crypto'
import { collectionPrefix, getFirebase } from './firebase.mjs'

function nowIso() {
  return new Date().toISOString()
}

function stripUndefined(value) {
  return JSON.parse(JSON.stringify(value))
}

export function repo() {
  const firebase = getFirebase()
  if (!firebase) throw new Error('Firebase אינו מוגדר')
  const prefix = collectionPrefix()
  const col = (name) => firebase.db.collection(`${prefix}${name}`)

  async function all(name) {
    const snap = await col(name).get()
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  }

  async function get(name, id) {
    const snap = await col(name).doc(id).get()
    return snap.exists ? { id: snap.id, ...snap.data() } : null
  }

  async function set(name, id, data) {
    await col(name).doc(id).set(stripUndefined({ ...data, id }), { merge: true })
    return get(name, id)
  }

  async function remove(name, id) {
    await col(name).doc(id).delete()
  }

  return {
    firebase,
    prefix,
    col,
    all,
    get,
    set,
    remove,
    async publicProducts() {
      const products = await all('products')
      return products
        .filter((product) => (product.status || (product.active === false ? 'inactive' : 'active')) === 'active')
        .map((product) => {
          const copy = { ...product }
          delete copy.costPrice
          delete copy.history
          delete copy.usedInOrders
          const start = copy.saleStart ? Date.parse(copy.saleStart) : 0
          const end = copy.saleEnd ? Date.parse(copy.saleEnd) : Number.POSITIVE_INFINITY
          if (copy.salePrice != null && copy.salePrice < copy.price && Date.now() >= start && Date.now() <= end) {
            copy.compareAt = copy.price
            copy.price = copy.salePrice
            copy.badge = copy.badge || 'sale'
          }
          return copy
        })
    },
    async settings() {
      const row = await get('settings', 'shop')
      return row || {}
    },
    async saveSettings(next) {
      return set('settings', 'shop', next)
    },
    async isAdminUid(uid) {
      const row = await get('admins', uid)
      return row?.role === 'admin'
    },
    async uploadBuffer(path, buffer, contentType) {
      const file = firebase.bucket.file(path)
      await file.save(buffer, { contentType, resumable: false, public: false })
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
        const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'
        return `http://${host}/v0/b/${firebase.storageBucket}/o/${encodeURIComponent(path)}?alt=media`
      }
      return `https://firebasestorage.googleapis.com/v0/b/${firebase.storageBucket}/o/${encodeURIComponent(path)}?alt=media`
    },
    async createOrderAtomic(order, stockUpdates) {
      const existing = order.idempotencyKey
        ? (await col('orders').where('idempotencyKey', '==', order.idempotencyKey).limit(1).get()).docs[0]
        : null
      if (existing) return { id: existing.id, ...existing.data(), duplicate: true }
      await firebase.db.runTransaction(async (tx) => {
        for (const update of stockUpdates) {
          const ref = col('products').doc(update.id)
          const snap = await tx.get(ref)
          if (!snap.exists) throw new Error('מוצר לא זמין')
          const product = snap.data()
          const allowEmpty = product.allowBackorder || product.trackInventory === false || update.allowEmpty
          const stock = Number(product.stock || 0)
          if (stock < update.qty && !allowEmpty) throw new Error(`אין מספיק מלאי עבור ${product.name}`)
          if (product.trackInventory !== false) {
            tx.update(ref, { stock: Math.max(0, stock - update.qty), updatedAt: nowIso() })
          }
        }
        tx.set(col('orders').doc(order.id), stripUndefined(order))
      })
      return order
    },
    nextId(prefixName) {
      return `${prefixName}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
    },
  }
}
