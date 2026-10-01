export const A11Y_KEY = 'propharm_accessibility'

export type A11yPrefs = {
  textScale: number
  contrast: boolean
  gray: boolean
  links: boolean
  readable: boolean
  motion: boolean
  cursor: boolean
}

export const A11Y_DEFAULT: A11yPrefs = {
  textScale: 0,
  contrast: false,
  gray: false,
  links: false,
  readable: false,
  motion: false,
  cursor: false,
}

const TEXT_MIN = -2
const TEXT_MAX = 3

export function clampTextScale(value: number) {
  return Math.min(TEXT_MAX, Math.max(TEXT_MIN, value))
}

export function readA11yPrefs(): A11yPrefs {
  try {
    const raw = localStorage.getItem(A11Y_KEY)
    if (!raw) return { ...A11Y_DEFAULT }
    const parsed = JSON.parse(raw) as Partial<A11yPrefs>
    return {
      ...A11Y_DEFAULT,
      ...parsed,
      textScale: clampTextScale(Number(parsed.textScale) || 0),
    }
  } catch {
    return { ...A11Y_DEFAULT }
  }
}

export function saveA11yPrefs(prefs: A11yPrefs) {
  localStorage.setItem(A11Y_KEY, JSON.stringify(prefs))
}

export function applyA11yPrefs(prefs: A11yPrefs) {
  const root = document.documentElement
  root.style.setProperty('--a11y-text-scale', String(1 + prefs.textScale * 0.12))
  root.classList.toggle('a11y-contrast', prefs.contrast)
  root.classList.toggle('a11y-gray', prefs.gray)
  root.classList.toggle('a11y-links', prefs.links)
  root.classList.toggle('a11y-readable', prefs.readable)
  root.classList.toggle('a11y-motion', prefs.motion)
  root.classList.toggle('a11y-cursor', prefs.cursor)
}

export function loadA11yPrefs() {
  const prefs = readA11yPrefs()
  applyA11yPrefs(prefs)
  return prefs
}
