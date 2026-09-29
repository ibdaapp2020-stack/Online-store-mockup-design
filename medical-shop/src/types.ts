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
}

export type Category = {
  id: CategoryId
  name: string
  blurb: string
}

export type CartLine = {
  productId: string
  qty: number
}

export type Customer = {
  name: string
  phone: string
  city: string
  address: string
}

export type OrderStatus = 'received' | 'packing' | 'shipped' | 'delivered'

export type OrderItem = {
  productId: string
  name: string
  price: number
  qty: number
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
