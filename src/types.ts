export type CategoryId = string

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
  choices?: { size: boolean; color: boolean; other: boolean; otherLabel: string; others: string[] }
  variants?: VariantRow[]
}

export type VariantRow = { size: string; color: string; other: string; stock: number }

export function optionStock(product: Product, pick: { size?: string; color?: string; other?: string } = {}) {
  const rows = product.variants ?? []
  if (!rows.length) return product.stock
  return rows
    .filter((row) => (!pick.size || row.size === pick.size) && (!pick.color || row.color === pick.color) && (!pick.other || row.other === pick.other))
    .reduce((sum, row) => sum + row.stock, 0)
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
  sort?: number
  image?: string
  active?: boolean
}

export type CartLine = {
  productId: string
  qty: number
  size?: string
  color?: string
  other?: string
}

export function variantLabel(item: { size?: string; color?: string; other?: string }) {
  return [item.size ? `מידה ${item.size}` : '', item.color ? `צבע ${item.color}` : '', item.other || ''].filter(Boolean).join(' · ')
}

export type Customer = {
  name: string
  phone: string
  email?: string
  city: string
  address: string
  customerId?: string
  language?: string
}

export type OrderStatus = 'received' | 'packing' | 'shipped' | 'delivered' | 'cancelled'

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
