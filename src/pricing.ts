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
  rules: { shippingFee: number; freeFrom: number; couponPercent: number; siteDiscountPercent?: number } = {
    shippingFee: SHIPPING_FEE,
    freeFrom: FREE_FROM,
    couponPercent: COUPON_RATE * 100,
    siteDiscountPercent: 0,
  },
): Quote {
  const couponDiscount = couponOn ? Math.round(subtotal * (rules.couponPercent / 100)) : 0
  const siteDiscount = (rules.siteDiscountPercent && rules.siteDiscountPercent > 0)
    ? Math.round((subtotal - couponDiscount) * (rules.siteDiscountPercent / 100))
    : 0
  const discount = couponDiscount + siteDiscount
  const shipping = subtotal === 0 || subtotal >= rules.freeFrom ? 0 : rules.shippingFee
  return {
    subtotal,
    discount,
    shipping,
    total: Math.max(0, subtotal - discount + shipping),
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
