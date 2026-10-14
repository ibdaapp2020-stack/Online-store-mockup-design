import type { Category, Product, ProductStatus, ShopSettings } from '../../types'
import { adminFetch, adminQuery } from '../api'

export type ProductStats = {
  total: number
  active: number
  lowStock: number
  outOfStock: number
  lowStockThreshold: number
}

export type ProductListResponse = {
  items: Product[]
  total: number
  page: number
  pageSize: number
  brands: string[]
  stats: ProductStats
}

export type ProductListQuery = {
  q?: string
  sku?: string
  barcode?: string
  category?: string
  brand?: string
  status?: string
  stock?: string
  sort?: string
  page?: number
  pageSize?: number
}

export type ImportResult = {
  created: number
  updated: number
  errors: Array<{ row: number; error: string }>
  total: number
}

export function listProducts(query: ProductListQuery) {
  return adminFetch<ProductListResponse>(`/api/admin/products${adminQuery(query)}`)
}

export function getProduct(id: string) {
  return adminFetch<Product>(`/api/admin/products/${id}`)
}

export function getCategories() {
  return adminFetch<Category[]>('/api/admin/categories')
}

export function getSettings() {
  return adminFetch<ShopSettings>('/api/admin/settings')
}

export function saveProduct(id: string | undefined, body: FormData) {
  return adminFetch<Product>(id ? `/api/admin/products/${id}` : '/api/admin/products', {
    method: id ? 'PATCH' : 'POST',
    body,
  })
}

export function deleteProduct(id: string) {
  return adminFetch<{ ok: boolean; archived?: boolean }>(`/api/admin/products/${id}`, { method: 'DELETE' })
}

export function duplicateProduct(id: string) {
  return adminFetch<Product>(`/api/admin/products/${id}/duplicate`, { method: 'POST' })
}

export function bulkProducts(ids: string[], action: 'activate' | 'deactivate' | 'archive') {
  return adminFetch<{ ok: boolean; count: number; status: ProductStatus }>('/api/admin/products/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, action }),
  })
}

export function importProducts(rows: Record<string, string>[]) {
  return adminFetch<ImportResult>('/api/admin/products/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
}

export function exportUrl(query: ProductListQuery) {
  return `/api/admin/products/export.csv${adminQuery(query)}`
}

export function toggleProductStatus(product: Product, status: ProductStatus) {
  const body = new FormData()
  body.append('name', product.name)
  body.append('category', product.category)
  body.append('price', String(product.price))
  body.append('stock', String(product.stock))
  body.append('description', product.description ?? '')
  body.append('specs', (product.specs ?? []).join('\n'))
  body.append('status', status)
  body.append('active', status === 'active' ? 'true' : 'false')
  body.append('sku', product.sku ?? '')
  body.append('barcode', product.barcode ?? '')
  body.append('brand', product.brand ?? '')
  body.append('image', product.image ?? '')
  body.append('images', JSON.stringify(product.images ?? []))
  return saveProduct(product.id, body)
}
