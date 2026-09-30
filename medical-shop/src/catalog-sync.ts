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

export function saveLiveCatalog(data: Omit<LiveCatalog, 'savedAt'> & { savedAt?: number }) {
  const payload: LiveCatalog = { ...data, savedAt: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(payload))
  window.dispatchEvent(new Event('medica-catalog'))
}

export function applyLiveCatalog(apiProducts: Product[], apiCategories: Category[], apiSettings: ShopSettings) {
  const live = readLiveCatalog()
  if (!live) return { products: apiProducts, categories: apiCategories, settings: apiSettings }
  return {
    products: live.products.filter((product) => product.active !== false),
    categories: live.categories.length ? live.categories : apiCategories,
    settings: live.settings ?? apiSettings,
  }
}

export async function snapshotAdminCatalog() {
  const [products, categories, settings] = await Promise.all([
    fetch('/api/admin/products', { credentials: 'include' }).then((response) => response.json()) as Promise<Product[]>,
    fetch('/api/admin/categories', { credentials: 'include' }).then((response) => response.json()) as Promise<Category[]>,
    fetch('/api/admin/settings', { credentials: 'include' }).then((response) => response.json()) as Promise<ShopSettings>,
  ])
  if (!Array.isArray(products)) return
  saveLiveCatalog({
    products,
    categories: Array.isArray(categories) ? categories : [],
    settings,
  })
}
