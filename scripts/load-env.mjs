import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvFiles(root) {
  for (const name of ['.env', '.env.local']) {
    const file = resolve(root, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (match && process.env[match[1]] == null) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
      }
    }
  }
}
