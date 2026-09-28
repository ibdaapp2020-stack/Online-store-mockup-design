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

export function quote(subtotal: number, couponOn: boolean): Quote {
  const discount = couponOn ? Math.round(subtotal * COUPON_RATE) : 0
  const shipping = subtotal === 0 || subtotal >= FREE_FROM ? 0 : SHIPPING_FEE
  return {
    subtotal,
    discount,
    shipping,
    total: subtotal - discount + shipping,
  }
}

export function money(value: number) {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
