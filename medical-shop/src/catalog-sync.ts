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

export function preferStoredImage(product: Product, api?: Product): Product {
  if (!product.image?.startsWith('data:')) return product
  if (api?.image && !api.image.startsWith('data:')) return { ...product, image: api.image }
  return product
}

export function applyLiveCatalog(apiProducts: Product[], apiCategories: Category[], apiSettings: ShopSettings) {
  const live = readLiveCatalog()
  if (!live) return { products: apiProducts, categories: apiCategories, settings: apiSettings }
  const liveById = new Map(live.products.map((product) => [product.id, product]))
  const products = apiProducts.map((product) => preferStoredImage(liveById.get(product.id) ?? product, product))
  return {
    products,
    categories: apiCategories.length ? apiCategories : live.categories,
    settings: apiSettings,
  }
}

export async function snapshotAdminCatalog() {
  const [catalog, categories, settings] = await Promise.all([
    fetch('/api/catalog').then((response) => response.json()) as Promise<{ products: Product[]; categories: Category[]; settings: ShopSettings }>,
    fetch('/api/admin/categories', { credentials: 'include' }).then((response) => response.json()) as Promise<Category[]>,
    fetch('/api/admin/settings', { credentials: 'include' }).then((response) => response.json()) as Promise<ShopSettings>,
  ])
  if (!Array.isArray(catalog.products)) return
  saveLiveCatalog({
    products: catalog.products,
    categories: Array.isArray(categories) && categories.length ? categories : catalog.categories,
    settings,
  })
}
