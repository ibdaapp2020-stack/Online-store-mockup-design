export type CategoryId = string

export type Badge = 'new' | 'sale' | 'popular'

export type ProductStatus = 'active' | 'inactive' | 'draft' | 'archived'

export type ProductEvent = {
  id: string
  productId: string
  kind: 'change' | 'inventory'
  actor: string
  detail: string
  createdAt: string
}

export type Product = {
  id: string
  name: string
  sku?: string
  barcode?: string
  brand?: string
  category: CategoryId
  subcategory?: string
  price: number
  compareAt?: number
  costPrice?: number
  salePrice?: number
  saleStart?: string
  saleEnd?: string
  description: string
  shortDescription?: string
  specs: string[]
  stock: number
  lowStockThreshold?: number
  trackInventory?: boolean
  allowBackorder?: boolean
  unit?: string
  badge?: Badge
  rating: number
  reviews: number
  tone: string
  image?: string
  images?: string[]
  active?: boolean
  status?: ProductStatus
  seoTitle?: string
  seoDescription?: string
  slug?: string
  createdAt?: string
  updatedAt?: string
  history?: ProductEvent[]
  usedInOrders?: boolean
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

export function isPublished(product: Product) {
  return product.status ? product.status === 'active' : product.active !== false
}

export function saleActive(product: Product, now = Date.now()) {
  if (product.salePrice == null || !Number.isFinite(product.salePrice) || product.salePrice >= product.price) return false
  const start = product.saleStart ? Date.parse(product.saleStart) : 0
  const end = product.saleEnd ? Date.parse(product.saleEnd) : Number.POSITIVE_INFINITY
  return Number.isFinite(start) && now >= start && now <= end
}

export function storePrice(product: Product) {
  if (saleActive(product) && product.salePrice != null) {
    return { price: product.salePrice, compareAt: product.price, onSale: true as const }
  }
  return {
    price: product.price,
    compareAt: product.compareAt,
    onSale: Boolean(product.compareAt && product.compareAt > product.price),
  }
}

export function stockState(product: Product, threshold = 5) {
  const limit = product.lowStockThreshold ?? threshold
  if (product.stock <= 0) return 'out' as const
  if (product.stock <= limit) return 'low' as const
  return 'in' as const
}

export function canPurchase(
  product: Product,
  settings?: { allowSellWithoutStock?: boolean },
  pick: { size?: string; color?: string; other?: string } = {},
) {
  if (!isPublished(product)) return false
  if (product.trackInventory === false) return true
  if (optionStock(product, pick) > 0) return true
  return Boolean(product.allowBackorder || settings?.allowSellWithoutStock)
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
  lowStockThreshold?: number
  allowSellWithoutStock?: boolean
  vatRate?: number
  vatIncluded?: boolean
}

export type Category = {
  id: CategoryId
  name: string
  blurb: string
  image?: string
  productCount?: number
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
