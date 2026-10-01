export function isPortal() {
  if (import.meta.env.VITE_APP_SURFACE === 'portal') return true
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'portal.propharm.dev' || host.startsWith('portal.')
}

export function storeUrl(path = '/') {
  const suffix = path.startsWith('/') ? path : `/${path}`
  if (typeof window === 'undefined') return `https://propharm.dev${suffix}`
  const host = window.location.hostname.toLowerCase()
  if (host === 'portal.propharm.dev') return `https://propharm.dev${suffix}`
  if (host.startsWith('portal.')) return `${window.location.protocol}//${host.replace(/^portal\./, '')}${suffix}`
  if (host === '127.0.0.1' || host === 'localhost') return `http://127.0.0.1:5174${suffix}`
  return `${window.location.origin}${suffix}`
}

export function portalUrl(path = '/') {
  const suffix = path.startsWith('/') ? path : `/${path}`
  if (typeof window === 'undefined') return `https://portal.propharm.dev${suffix}`
  const host = window.location.hostname.toLowerCase()
  if (host === 'propharm.dev' || host === 'www.propharm.dev') return `https://portal.propharm.dev${suffix}`
  if (host === '127.0.0.1' || host === 'localhost') return `http://127.0.0.1:5176${suffix}`
  if (host.startsWith('portal.')) return `${window.location.origin}${suffix}`
  return `https://portal.propharm.dev${suffix}`
}
