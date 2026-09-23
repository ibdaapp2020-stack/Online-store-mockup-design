import type { Audience, CategoryId, Product, Setup } from './types'

export const DATA_VERSION = '3'

export { SEED, banners } from './catalog'

export const clubGifts = [
  { id: '10k', spend: 10000, title: 'מתנה ב־10,000 ₪', prize: 'אוזניות אלחוטיות או שובר 300 ₪' },
  { id: '20k', spend: 20000, title: 'מתנה ב־20,000 ₪', prize: 'Apple Watch SE או שובר 700 ₪' },
]

export const categories: {
  id: CategoryId
  name: string
  line: string
  audience: 'all' | Audience
  subs: { id: string; name: string }[]
}[] = [
  {
    id: 'mobile',
    name: 'סלולר',
    line: 'אייפון, סמסונג, פיקסל ושיאומי',
    audience: 'all',
    subs: [
      { id: 'iphone', name: 'iPhone' },
      { id: 'samsung', name: 'Samsung' },
      { id: 'pixel', name: 'Google Pixel' },
      { id: 'xiaomi', name: 'Xiaomi' },
    ],
  },
  {
    id: 'computer',
    name: 'מחשבים',
    line: 'מק, ווינדוס, טאבלטים ומסכים',
    audience: 'all',
    subs: [
      { id: 'mac', name: 'Mac' },
      { id: 'windows', name: 'Windows' },
      { id: 'tablet', name: 'טאבלטים' },
      { id: 'monitor', name: 'מסכים' },
    ],
  },
  {
    id: 'gaming',
    name: 'גיימינג',
    line: 'קונסולות וציוד משחק',
    audience: 'all',
    subs: [
      { id: 'console', name: 'קונסולות' },
      { id: 'gear', name: 'ציוד משחק' },
    ],
  },
  {
    id: 'accessories',
    name: 'אביזרים',
    line: 'שמע, טעינה, שעונים ומיגון',
    audience: 'all',
    subs: [
      { id: 'audio', name: 'שמע' },
      { id: 'power', name: 'טעינה וחיבור' },
      { id: 'wear', name: 'שעונים' },
      { id: 'protect', name: 'מיגון' },
    ],
  },
  {
    id: 'repair',
    name: 'מעבדה עד הבית',
    line: 'תיקונים אצלכם או באיסוף מהמעבדה',
    audience: 'all',
    subs: [
      { id: 'visit', name: 'עד הבית' },
      { id: 'lab', name: 'במעבדה' },
    ],
  },
  {
    id: 'enterprise',
    name: 'ציוד מחלקות',
    line: 'חבילות לעסקים בלבד',
    audience: 'business',
    subs: [
      { id: 'fleet', name: 'ערכות עובדים' },
      { id: 'meeting', name: 'משרד ומחסן' },
    ],
  },
]

export const setups: Setup[] = [
  {
    id: 'pocket',
    name: 'הכיס המושלם',
    line: 'מכשיר, מיגון, טעינה ושמע',
    roles: [
      { id: 'device', label: 'מכשיר' },
      { id: 'guard', label: 'מיגון' },
      { id: 'power', label: 'טעינה' },
      { id: 'audio', label: 'שמע' },
    ],
  },
  {
    id: 'desk',
    name: 'עמדת עבודה',
    line: 'מחשב, מקלדת, עכבר ומסך או חיבור',
    roles: [
      { id: 'computer', label: 'מחשב' },
      { id: 'keys', label: 'מקלדת' },
      { id: 'mouse', label: 'עכבר' },
      { id: 'screen', label: 'מסך או חיבור' },
    ],
  },
  {
    id: 'play',
    name: 'עמדת גיימינג',
    line: 'שמע, עכבר, מקלדת ובקר',
    roles: [
      { id: 'audio', label: 'שמע' },
      { id: 'mouse', label: 'עכבר' },
      { id: 'keys', label: 'מקלדת' },
      { id: 'pad', label: 'בקר' },
    ],
  },
]

export const blueprints: Record<string, string[]> = {
  pocket: ['iphone-17', 'magsafe-case', 'charger-35', 'airpods-pro'],
  desk: ['mba-13', 'keyboard', 'mouse', 'monitor-27'],
  play: ['pulse-headset', 'gpro-mouse', 'gpro-keys', 'dualsense'],
}

export function blueprintFor(setupId: string, audience: Audience) {
  if (audience === 'business' && setupId === 'desk') return ['mbp-14', 'keyboard', 'mouse', 'dock']
  return blueprints[setupId] ?? []
}

export function categoryName(id: CategoryId) {
  return categories.find((category) => category.id === id)?.name ?? id
}

export function setupById(id?: string) {
  return setups.find((setup) => setup.id === id)
}

export function subName(categoryId: string, subId?: string) {
  return categories.find((category) => category.id === categoryId)?.subs.find((sub) => sub.id === subId)?.name
}

export function visibleCategories(audience: Audience | null) {
  return categories.filter((category) => category.audience === 'all' || category.audience === audience)
}

export function productVisible(product: Product, audience: Audience | null) {
  const category = categories.find((item) => item.id === product.category)
  if (!category) return false
  return category.audience === 'all' || category.audience === audience
}
