import express from 'express'
import { applyAdminCors, registerAdminCatalog } from '../../server/admin-catalog.mjs'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use((req, res, next) => {
  applyAdminCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})
registerAdminCatalog(app)

export default app
