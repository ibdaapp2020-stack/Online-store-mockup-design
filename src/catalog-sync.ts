import type { Category, Product, ShopSettings } from './types'

const KEY = 'medica-live-catalog'

export type LiveCatalog = {
  savedAt: number
  products: Product[]
  categories: Category[]
  settings?: ShopSettings
}

export function readLiveCatalog(): LiveCatalog | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as LiveCatalog
    if (!Array.isArray(data.products) || !Array.isArray(data.categories)) return null
    return data
  } catch {
    return null
  }
}

export function preferStoredImage(product: Product, api?: Product): Product {
  if (!product.image?.startsWith('data:')) return product
  if (api?.image && !api.image.startsWith('data:')) return { ...product, image: api.image }
  return product
}

export function applyLiveCatalog(apiProducts: Product[], apiCategories: Category[], apiSettings: ShopSettings) {
  return {
    products: apiProducts.filter((product) => product.active !== false),
    categories: apiCategories,
    settings: apiSettings,
  }
}

export async function snapshotAdminCatalog() {
  window.dispatchEvent(new Event('medica-catalog'))
}
