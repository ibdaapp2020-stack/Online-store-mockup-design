import express from 'express'
import { loadPublicCatalog } from '../server/catalog-public.mjs'

const app = express()

async function sendCatalog(_req, res) {
  try {
    const data = await loadPublicCatalog()
    res.setHeader('Cache-Control', 'no-store, max-age=0')
    res.status(200).json(data)
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'לא ניתן לטעון את החנות' })
  }
}

app.get('/', sendCatalog)
app.get('/catalog', sendCatalog)
app.get('/api/catalog', sendCatalog)

export default app
