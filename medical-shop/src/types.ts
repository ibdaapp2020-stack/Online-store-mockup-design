export type CategoryId = 'first-aid' | 'monitors' | 'vitamins' | 'hygiene' | 'ortho' | 'home'

export type Badge = 'new' | 'sale' | 'popular'

export type Product = {
  id: string
  name: string
  category: CategoryId
  price: number
  compareAt?: number
  description: string
  specs: string[]
  stock: number
  badge?: Badge
  rating: number
  reviews: number
  tone: string
  image?: string
  active?: boolean
  sizes?: string[]
  colors?: string[]
}

export type ShopSettings = {
  storeName: string
  tagline: string
  banner: string
  showBanner: boolean
  disclaimer: string
  shippingFee: number
  freeFrom: number
  couponCode: string
  couponPercent: number
  paymentNote: string
  loyaltyMode: 'points' | 'percent'
  pointsPer100: number
  clubPercent: number
  notifyEmail: string
  smtpUser: string
  smtpPass?: string
  smtpConfigured?: boolean
}

export type Category = {
  id: CategoryId
  name: string
  blurb: string
}

export type CartLine = {
  productId: string
  qty: number
  size?: string
  color?: string
}

export function variantLabel(item: { size?: string; color?: string }) {
  return [item.size ? `מידה ${item.size}` : '', item.color ? `צבע ${item.color}` : ''].filter(Boolean).join(' · ')
}

export type Customer = {
  name: string
  phone: string
  city: string
  address: string
  customerId?: string
}

export type OrderStatus = 'received' | 'packing' | 'shipped' | 'delivered'

export type OrderItem = {
  productId: string
  name: string
  price: number
  qty: number
  size?: string
  color?: string
}

export type Order = {
  id: string
  createdAt: string
  status: OrderStatus
  customer: Customer
  items: OrderItem[]
  subtotal: number
  discount: number
  shipping: number
  total: number
  coupon?: string
}
