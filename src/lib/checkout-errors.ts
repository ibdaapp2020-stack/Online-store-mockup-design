export type CheckoutErrorKind =
  | 'permission'
  | 'network'
  | 'server'
  | 'payment_declined'
  | 'invalid_card'
  | 'out_of_stock'
  | 'validation'
  | 'payment_unknown'
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
  const lower = text.toLowerCase()

  if (lower.includes('אין מספיק מלאי') || lower.includes('מוצר לא זמין') || lower.includes('out of stock')) {
    return {
      kind: 'out_of_stock',
      title: 'המוצר אינו זמין',
      message: 'אחד המוצרים בהזמנה אינו זמין בכמות שנבחרה. עדכנו את הסל ונסו שוב.',
      retry: false,
      backToCart: true,
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
  if (lower.includes('declined') || lower.includes('לא אושר')) {
    return {
      kind: 'payment_declined',
      title: 'התשלום לא אושר',
      message: 'התשלום לא אושר על ידי חברת האשראי. ניתן לבדוק את פרטי הכרטיס ולנסות שוב.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (status === 0 && (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('offline'))) {
    return {
      kind: 'network',
      title: 'בעיית תקשורת',
      message: 'לא הצלחנו להתחבר לשרת. בדקו את החיבור לאינטרנט ונסו שוב.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (status === 500 || status === 502 || status === 503 || lower.includes('502') || lower.includes('503')) {
    return {
      kind: 'server',
      title: 'השירות אינו זמין כרגע',
      message: 'יש תקלה זמנית בשירות. ההזמנה לא הושלמה. נסו שוב בעוד מספר רגעים.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (
    lower.includes('permission') ||
    lower.includes('insufficient') ||
    lower.includes('permission-denied') ||
    status === 403
  ) {
    return {
      kind: 'permission',
      title: 'לא הצלחנו להשלים את ההזמנה',
      message: 'לא ניתן היה להשלים את ההזמנה כרגע. לא בוצע חיוב. נסו שוב בעוד מספר רגעים.',
      retry: true,
      backToCart: false,
      chargedUnknown: false,
    }
  }
  if (lower.includes('לא ניתן לאמת') || lower.includes('unknown payment')) {
    return {
      kind: 'payment_unknown',
      title: 'לא ניתן לאמת את מצב התשלום',
      message: 'לא הצלחנו לקבל אישור סופי על התשלום. אין לבצע תשלום נוסף לפני בדיקת סטטוס ההזמנה.',
      retry: false,
      backToCart: true,
      chargedUnknown: true,
    }
  }
  return {
    kind: 'unknown',
    title: 'לא הצלחנו להשלים את הפעולה',
    message: 'אירעה תקלה בלתי צפויה. לא בוצע חיוב. נסו שוב.',
    retry: true,
    backToCart: false,
    chargedUnknown: false,
  }
}

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { httpStatus: status })
}
