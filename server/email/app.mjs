import express from 'express'
import { loadEnv } from '../db.mjs'
import { registerEmailRoutes } from './routes.mjs'

loadEnv()

const app = express()
app.use(express.json({ limit: '2mb' }))
registerEmailRoutes(app, {
  requireAdmin(_req, res) {
    return res.status(401).json({ error: 'נדרשת כניסת ניהול' })
  },
})

export default app
