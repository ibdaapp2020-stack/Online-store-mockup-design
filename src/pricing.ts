import { blueprintFor, setups } from './data'
import type { Audience, CartLine, Product, Setup, ShipMethod } from './types'

export const VAT_RATE = 0.17

export const volumeTiers = [
  { qty: 5, rate: 0.05, label: '5%' },
  { qty: 10, rate: 0.09, label: '9%' },
  { qty: 25, rate: 0.14, label: '14%' },
]

export function money(value: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(Math.round(value))
}

export function setupRate(audience: Audience) {
  return audience === 'private' ? 0.08 : 0.04
}

export function setupRateLabel(audience: Audience) {
  return audience === 'private' ? '8%' : '4%'
}

export function volumeRate(qty: number) {
  let rate = 0
  for (const tier of volumeTiers) {
    if (qty >= tier.qty) rate = tier.rate
  }
  return rate
}

export function netOf(priceInc: number) {
  return Math.round(priceInc / (1 + VAT_RATE))
}

export function lineKey(line: { productId: string; color?: string; storage?: string }) {
  return `${line.productId}::${line.color ?? ''}::${line.storage ?? ''}`
}

export function unitFor(product: Product, audience: Audience, qty: number, priceAdd = 0) {
  const consumer = product.price + priceAdd
  if (audience === 'private') {
    return { unit: consumer, volume: 0, list: consumer }
  }
  const list = netOf(consumer)
  const volume = volumeRate(qty)
  return { unit: Math.round(list * (1 - volume)), volume, list }
}

export type SetupProgress = {
  setup: Setup
  filledRoles: { id: string; label: string }[]
  missing: { id: string; label: string }[]
  complete: boolean
  ratio: number
}

export function progressFor(products: Product[], lines: CartLine[]): SetupProgress[] {
  return setups.map((setup) => {
    const filledRoles = setup.roles.filter((role) =>
      lines.some((line) => {
        if (line.qty <= 0) return false
        const product = products.find((item) => item.id === line.productId && item.active)
        return product?.setupId === setup.id && product.role === role.id
      }),
    )
    const missing = setup.roles.filter((role) => !filledRoles.some((filled) => filled.id === role.id))
    return {
      setup,
      filledRoles,
      missing,
      complete: missing.length === 0,
      ratio: filledRoles.length / setup.roles.length,
    }
  })
}

export function suggestForRole(
  products: Product[],
  setupId: string,
  roleId: string,
  audience: Audience,
) {
  for (const id of blueprintFor(setupId, audience)) {
    const product = products.find(
      (item) => item.id === id && item.active && item.stock > 0 && item.role === roleId,
    )
    if (product) return product
  }
  return products.find(
    (item) => item.active && item.stock > 0 && item.setupId === setupId && item.role === roleId,
  )
}

export function nextGap(products: Product[], cart: CartLine[], audience: Audience) {
  const open = progressFor(products, cart)
    .filter((item) => item.filledRoles.length > 0 && !item.complete)
    .sort((a, b) => b.ratio - a.ratio)
  const first = open[0]
  if (!first) return null
  const role = first.missing[0]
  return {
    setup: first.setup,
    role,
    product: suggestForRole(products, first.setup.id, role.id, audience),
    filled: first.filledRoles.length,
    total: first.setup.roles.length,
  }
}

export type QuoteLine = {
  key: string
  product: Product
  qty: number
  unit: number
  volume: number
  list: number
  line: number
  color?: string
  storage?: string
}

export type Quote = {
  lines: QuoteLine[]
  merchandise: number
  volumeSaved: number
  setupSavings: { setup: Setup; amount: number }[]
  discount: number
  shipping: number
  net: number
  vat: number
  total: number
  progress: SetupProgress[]
}

export function quote(
  products: Product[],
  cart: CartLine[],
  audience: Audience,
  ship: ShipMethod,
): Quote {
  const lines = cart.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId && item.active)
    if (!product || line.qty <= 0) return []
    const priced = unitFor(product, audience, line.qty, line.priceAdd ?? 0)
    return [
      {
        key: lineKey(line),
        product,
        qty: line.qty,
        unit: priced.unit,
        volume: priced.volume,
        list: priced.list,
        line: priced.unit * line.qty,
        color: line.color,
        storage: line.storage,
      },
    ]
  })

  const merchandise = lines.reduce((sum, line) => sum + line.line, 0)
  const volumeSaved = lines.reduce((sum, line) => sum + (line.list - line.unit) * line.qty, 0)
  const progress = progressFor(products, cart)
  const rate = setupRate(audience)
  const setupSavings = progress
    .filter((item) => item.complete)
    .map((item) => {
      const subtotal = lines
        .filter((line) => line.product.setupId === item.setup.id)
        .reduce((sum, line) => sum + line.line, 0)
      return { setup: item.setup, amount: Math.round(subtotal * rate) }
    })
    .filter((item) => item.amount > 0)

  const discount = setupSavings.reduce((sum, item) => sum + item.amount, 0)
  const after = Math.max(0, merchandise - discount)
  const complete = progress.some((item) => item.complete && item.filledRoles.length > 0)

  let shipping = 0
  if (ship === 'pickup') shipping = 0
  else if (ship === 'express') shipping = complete ? 19 : 49
  else if (audience === 'private') shipping = after >= 399 || complete ? 0 : 29
  else shipping = after >= 1200 || complete ? 0 : 49

  if (audience === 'private') {
    const gross = after + shipping
    const net = Math.round(gross / (1 + VAT_RATE))
    return {
      lines,
      merchandise,
      volumeSaved,
      setupSavings,
      discount,
      shipping,
      net,
      vat: gross - net,
      total: gross,
      progress,
    }
  }

  const net = after + shipping
  const vat = Math.round(net * VAT_RATE)
  return {
    lines,
    merchandise,
    volumeSaved,
    setupSavings,
    discount,
    shipping,
    net,
    vat,
    total: net + vat,
    progress,
  }
}
