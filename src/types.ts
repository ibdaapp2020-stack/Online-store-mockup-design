export type Audience = 'private' | 'business'

export type CategoryId = 'mobile' | 'computer' | 'gaming' | 'accessories' | 'repair' | 'enterprise'

export type ShipMethod = 'standard' | 'express' | 'pickup'

export type OrderStatus = 'new' | 'processing' | 'done' | 'cancelled'

export type Product = {
  id: string
  name: string
  brand: string
  category: CategoryId
  price: number
  blurb: string
  story?: string
  specs: string[]
  setupId?: string
  role?: string
  fit: 'all' | Audience
  badge?: string
  stock: number
  active: boolean
  rating: number
  reviews: number
  pairWith?: string[]
  sub?: string
  colors?: { id: string; name: string; hex: string }[]
  storages?: { id: string; label: string; add: number }[]
  images?: string[]
  official?: string
  video?: string
}

export type Setup = {
  id: string
  name: string
  line: string
  roles: { id: string; label: string }[]
}

export type CartLine = {
  productId: string
  qty: number
  color?: string
  storage?: string
  priceAdd?: number
}

export type Order = {
  id: string
  audience: Audience
  kind: 'order' | 'quote'
  ship: ShipMethod
  payment: string
  payments: number
  createdAt: string
  status: OrderStatus
  lines: { productId: string; name: string; qty: number; unit: number }[]
  discount: number
  shipping: number
  vat: number
  total: number
  customer: {
    name: string
    phone: string
    address: string
    note: string
    email: string
  }
  invoiceId?: string
  invoiceSentAt?: string
  pointsEarned?: number
}

export type ClubProfile = {
  name: string
  phone: string
  email: string
  points: number
  spent: number
  claimed: string[]
}

export type RepairRequest = {
  id: string
  name: string
  phone: string
  device: string
  issue: string
  visit: 'home' | 'lab'
  photos: string[]
  createdAt: string
}

export type BusinessAccount = {
  username: string
  password: string
  company: string
  hp: string
  contact: string
  phone: string
  email: string
}

export type PlaceInput = {
  kind: 'order' | 'quote'
  ship: ShipMethod
  payment: string
  payments: number
  customer: Order['customer']
}
