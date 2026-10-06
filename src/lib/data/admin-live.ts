import { collection, onSnapshot } from 'firebase/firestore'
import { db, orderFrom } from './core'
import { mergeCustomers } from './customers'
import type { Order } from '../../types'

export function watchAdminOrders(onData: (orders: Order[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db(), 'orders'),
    (snap) => {
      const rows = snap.docs.map((item) => orderFrom(item.id, item.data())).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      onData(rows)
    },
    (error) => onError(error instanceof Error ? error : new Error('orders')),
  )
}

export function watchAdminCustomers(onData: (members: Array<Record<string, unknown>>) => void, onError: (error: Error) => void) {
  let orders: Order[] = []
  let registered: Array<Record<string, unknown>> = []
  let ordersReady = false
  let customersReady = false

  function emit() {
    if (!ordersReady || !customersReady) return
    onData(mergeCustomers(registered, orders))
  }

  const stopOrders = onSnapshot(
    collection(db(), 'orders'),
    (snap) => {
      orders = snap.docs.map((item) => orderFrom(item.id, item.data()))
      ordersReady = true
      emit()
    },
    (error) => onError(error instanceof Error ? error : new Error('orders')),
  )
  const stopCustomers = onSnapshot(
    collection(db(), 'customers'),
    (snap) => {
      registered = snap.docs.map((item) => ({ id: item.id, ...item.data() }))
      customersReady = true
      emit()
    },
    (error) => onError(error instanceof Error ? error : new Error('customers')),
  )

  return () => {
    stopOrders()
    stopCustomers()
  }
}

function serviceFrom(id: string, data: Record<string, unknown>) {
  const cap = Number(data.capacity) || (id === 'hyperbaric' || String(data.name || '').includes('לחץ') || String(data.name || '').includes('חמצן') ? 2 : 1)
  return {
    id: String(data.id || id),
    name: String(data.name || data.title || ''),
    days: Array.isArray(data.days) ? data.days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    openTime: String(data.openTime || data.open_time || '09:00'),
    closeTime: String(data.closeTime || data.close_time || '19:00'),
    slotMinutes: Number(data.slotMinutes || data.slot_minutes) || 60,
    therapist: String(data.therapist || data.provider || ''),
    capacity: cap,
    active: data.active !== false,
  }
}

export function watchAdminServices(onData: (rows: ReturnType<typeof serviceFrom>[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db(), 'services'),
    (snap) => onData(snap.docs.map((item) => serviceFrom(item.id, item.data()))),
    (error) => onError(error instanceof Error ? error : new Error('services')),
  )
}

export function watchAdminCategories(onData: (rows: Array<{ id: string; name: string; blurb: string; sort: number; active?: boolean; image?: string }>) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db(), 'categories'),
    (snap) => {
      onData(
        snap.docs
          .map((item) => {
            const data = item.data()
            return {
              id: item.id,
              name: String(data.name || ''),
              blurb: String(data.blurb || ''),
              sort: Number(data.sort) || 0,
              image: String(data.image || ''),
              active: data.active !== false,
            }
          })
          .sort((a, b) => a.sort - b.sort),
      )
    },
    (error) => onError(error instanceof Error ? error : new Error('categories')),
  )
}

export function watchAdminAppointments(onData: (rows: Array<Record<string, unknown>>) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db(), 'appointments'),
    (snap) => onData(snap.docs.map((item) => ({ id: item.id, ...item.data() }))),
    (error) => onError(error instanceof Error ? error : new Error('appointments')),
  )
}
