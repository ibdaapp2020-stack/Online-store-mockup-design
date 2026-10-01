import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = process.env.VERCEL ? '/tmp' : join(root, 'data')
const liveFile = join(dataDir, 'shop-live.json')

function memory() {
  const slot = globalThis
  if (!slot.__medicaLive) slot.__medicaLive = { json: '' }
  return slot.__medicaLive
}

function dump(db) {
  return JSON.stringify({
    savedAt: Date.now(),
    products: db.prepare('SELECT * FROM products').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    settings: db.prepare('SELECT data FROM settings WHERE id = 1').get()?.data ?? '{}',
  })
}

function insertRows(db, table, rows) {
  if (!rows?.length) return
  const columns = Object.keys(rows[0])
  const placeholders = columns.map(() => '?').join(', ')
  const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
  const statement = db.prepare(sql)
  for (const row of rows) statement.run(...columns.map((column) => row[column]))
}

export function restoreLive(db) {
  const mem = memory()
  let raw = mem.json
  if (!raw && existsSync(liveFile)) raw = readFileSync(liveFile, 'utf8')
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data.products) || !Array.isArray(data.categories)) return false
    db.exec('BEGIN')
    db.exec('DELETE FROM products')
    db.exec('DELETE FROM categories')
    insertRows(db, 'categories', data.categories)
    insertRows(db, 'products', data.products)
    if (data.settings) db.prepare('UPDATE settings SET data = ? WHERE id = 1').run(data.settings)
    db.exec('COMMIT')
    mem.json = raw
    return true
  } catch {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* ignore */
    }
    return false
  }
}

export function persistLive(db) {
  mkdirSync(dataDir, { recursive: true })
  const json = dump(db)
  memory().json = json
  writeFileSync(liveFile, json)
}
