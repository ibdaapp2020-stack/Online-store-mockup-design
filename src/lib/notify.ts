import { currentUser } from './data/auth'

async function serverNotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && typeof init?.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  const user = currentUser()
  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`)
  }
  const response = await fetch(path, { ...init, headers })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'שליחת ההתראה נכשלה')
  return payload
}

export async function notifyOrderCreated(order: unknown, stockAfter: unknown[] = [], language = 'he') {
  try {
    await serverNotifyFetch('/api/notify/order-created', {
      method: 'POST',
      body: JSON.stringify({ order, stockAfter, language }),
    })
  } catch {
    /* order already saved */
  }
}

export async function notifyOrderStatus(order: unknown, language = 'he') {
  try {
    await serverNotifyFetch('/api/notify/order-status', {
      method: 'POST',
      body: JSON.stringify({ order, language }),
    })
  } catch {
    /* status already saved */
  }
}

export async function notifyStockChange(input: { productId: string; name?: string; previous?: number; next?: number }) {
  try {
    await serverNotifyFetch('/api/notify/stock', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  } catch {
    /* product already saved */
  }
}

export function emailAdminFetch<T>(path: string, init?: RequestInit) {
  return serverNotifyFetch<T>(path, init)
}
