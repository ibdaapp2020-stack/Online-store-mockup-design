export type CheckoutErrorKind =
  | 'network'
  | 'product_changed'
  | 'out_of_stock'
  | 'payment_failed'
  | 'order_save_failed'
  | 'service_unavailable'
  | 'validation'
  | 'unknown'

export type CheckoutErrorView = {
  kind: CheckoutErrorKind
  title: string
  message: string
  retry: boolean
  backToCart: boolean
  chargedUnknown: boolean
}

export function checkoutErrorView(reason: unknown): CheckoutErrorView {
  const text = reason instanceof Error ? reason.message : String(reason || '')
  const status = reason && typeof reason === 'object' && 'httpStatus' in reason ? Number((reason as { httpStatus?: number }).httpStatus) : 0
  const code = reason && typeof reason === 'object' && 'code' in reason ? String((reason as { code?: string }).code || '') : ''
  const lower = `${code} ${text}`.toLowerCase()

  if (status === 0 && (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline'))) {
    return {
      kind: 'network',
      title: 'בעיית תקשורת',
      message: 'לא הצלחנו להתחבר לשירות ההזמנות. בדקו את החיבור ונסו שוב.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (lower.includes('product_changed') || lower.includes('השתנה')) {
    return {
      kind: 'product_changed',
      title: 'הסל עודכן',
      message: 'אחד המוצרים בהזמנה השתנה. רעננו את הסל ונסו שוב.',
      retry: false,
      backToCart: true,
      chargedUnknown: false,
    }
  }
  if (lower.includes('out_of_stock') || lower.includes('אין מספיק מלאי') || lower.includes('מוצר לא זמין')) {
    return {
      kind: 'out_of_stock',
      title: 'המוצר אינו זמין',
      message: 'אחד המוצרים אינו זמין בכמות שבחרתם.',
      retry: false,
      backToCart: true,
      chargedUnknown: false,
    }
  }
  if (lower.includes('payment_failed') || lower.includes('declined') || lower.includes('לא אושר')) {
    return {
      kind: 'payment_failed',
      title: 'התשלום לא אושר',
      message: 'התשלום לא אושר. ניתן לנסות שוב.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (
    code === 'MISSING_SERVER_AUTH' ||
    code === 'ORDER_SAVE_FAILED' ||
    lower.includes('לא בוצע חיוב') ||
    lower.includes('order_save')
  ) {
    return {
      kind: 'order_save_failed',
      title: 'ההזמנה לא נשמרה',
      message: 'לא הצלחנו לשמור את ההזמנה. לא בוצע חיוב.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (status === 500 || status === 502 || status === 503 || code === 'SERVICE_UNAVAILABLE' || code === 'SERVER_AUTH_FAILED') {
    return {
      kind: 'service_unavailable',
      title: 'השירות אינו זמין',
      message: 'שירות ההזמנות אינו זמין כרגע. נסו שוב בעוד מספר רגעים.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (lower.includes('חסרים') || lower.includes('validation')) {
    return {
      kind: 'validation',
      title: 'חסרים פרטים',
      message: 'יש להשלים את השדות המסומנים לפני המשך ההזמנה.',
      retry: false,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  return {
    kind: 'unknown',
    title: 'לא הצלחנו להשלים את ההזמנה',
    message: 'לא הצלחנו לשמור את ההזמנה. לא בוצע חיוב.',
    retry: true,
    backToCart: false,
    chargedUnknown: false,
  }
}

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { httpStatus: status })
}
