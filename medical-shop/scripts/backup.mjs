import { DatabaseSync } from 'node:sqlite'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dest = join(root, 'backups', `pro-pharm-${stamp}`)

mkdirSync(dest, { recursive: true })
mkdirSync(join(dest, 'data'), { recursive: true })
mkdirSync(join(dest, 'public'), { recursive: true })

const dbPath = join(root, 'data', 'shop.db')
if (existsSync(dbPath)) {
  const db = new DatabaseSync(dbPath)
  try {
    db.exec('PRAGMA wal_checkpoint(FULL)')
  } catch {
    /* keep copying even if checkpoint is locked */
  }
  db.close()
}

const copies = [
  ['data/shop.db', 'data/shop.db'],
  ['data/shop.db-wal', 'data/shop.db-wal'],
  ['data/shop.db-shm', 'data/shop.db-shm'],
  ['data/shop-live.json', 'data/shop-live.json'],
  ['public/products', 'public/products'],
  ['public/uploads', 'public/uploads'],
  ['public/logo.jpg', 'public/logo.jpg'],
  ['public/favicon.svg', 'public/favicon.svg'],
]

const copied = []
for (const [from, to] of copies) {
  const source = join(root, from)
  if (!existsSync(source)) continue
  cpSync(source, join(dest, to), { recursive: true })
  copied.push(from)
}

const inventory = spawnSync(process.execPath, [join(root, 'scripts', 'inventory.mjs')], { encoding: 'utf8' })
writeFileSync(join(dest, 'inventory.json'), inventory.stdout || inventory.stderr || '{}')
writeFileSync(
  join(dest, 'README.txt'),
  [
    'גיבוי PRO PHARM',
    `נוצר: ${new Date().toISOString()}`,
    `תיקייה: ${dest}`,
    '',
    'שחזור מקומי:',
    '1. עצרו את השרת.',
    '2. העתיקו את data/ חזרה אל medical-shop/data/',
    '3. העתיקו את public/products ו-public/uploads חזרה.',
    '4. אל תמחקו את הגיבוי.',
    '',
    'הגיבוי אינו מוחק את SQLite החי.',
  ].join('\n'),
)

console.log(JSON.stringify({ ok: true, dest, copied, inventoryOk: inventory.status === 0 }, null, 2))
