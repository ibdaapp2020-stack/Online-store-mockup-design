export const SHIPPING_FEE = 29
export const FREE_FROM = 199
export const COUPON_CODE = 'DEMO10'
export const COUPON_RATE = 0.1

export type Quote = {
  subtotal: number
  discount: number
  shipping: number
  total: number
}

export function quote(
  subtotal: number,
  couponOn: boolean,
  rules: { shippingFee: number; freeFrom: number; couponPercent: number } = {
    shippingFee: SHIPPING_FEE,
    freeFrom: FREE_FROM,
    couponPercent: COUPON_RATE * 100,
  },
): Quote {
  const discount = couponOn ? Math.round(subtotal * (rules.couponPercent / 100)) : 0
  const shipping = subtotal === 0 || subtotal >= rules.freeFrom ? 0 : rules.shippingFee
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
  }
}

export function roundMoney(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

export function money(value: number, digits = 0) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(roundMoney(value, digits))
}

export function moneyExact(value: number) {
  return money(value, 2)
}

export function grossProfit(price: number, cost?: number, vatRate = 0, vatIncluded = true) {
  if (cost == null || !Number.isFinite(cost)) return null
  const net = vatIncluded && vatRate > 0 ? price / (1 + vatRate / 100) : price
  const profit = roundMoney(net - cost)
  const margin = net === 0 ? 0 : roundMoney((profit / net) * 100)
  return { profit, margin, net: roundMoney(net) }
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
