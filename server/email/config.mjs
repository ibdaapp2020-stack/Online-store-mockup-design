export function emailConfig() {
  const senderName = process.env.BREVO_SENDER_NAME || 'PRO PHARM'
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@propharm.dev'
  return {
    provider: process.env.MAIL_PROVIDER || 'BREVO',
    baseUrl: (process.env.BREVO_BASE_URL || 'https://api.brevo.com/v3').replace(/\/$/, ''),
    apiKey: process.env.BREVO_API_KEY || '',
    senderName,
    senderEmail,
    adminEmail: process.env.PROPHARM_ADMIN_EMAIL || 'propharm2026@gmail.com',
    storeUrl: (process.env.PUBLIC_STORE_URL || 'https://propharm.dev').replace(/\/$/, ''),
    portalUrl: (process.env.ADMIN_PORTAL_URL || 'https://portal.propharm.dev').replace(/\/$/, ''),
    replyTo: process.env.BREVO_REPLY_TO || process.env.PROPHARM_ADMIN_EMAIL || 'propharm2026@gmail.com',
    lowStockThreshold: Math.max(1, Number(process.env.PROPHARM_LOW_STOCK || 5) || 5),
  }
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function resolveLang(value) {
  const lang = String(value || '').toLowerCase()
  if (lang.startsWith('ar')) return 'ar'
  if (lang.startsWith('en')) return 'en'
  return 'he'
}
