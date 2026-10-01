import { initDb, loadEnv } from '../server/db.mjs'
import { notifyOrderCreated, previewEmail } from '../server/email/service.mjs'

loadEnv()
await initDb()

const order = {
  id: 'MED-EMAIL-TEST',
  createdAt: new Date().toISOString(),
  status: 'received',
  customer: { name: 'x', email: 'abulieltasneem23@gmail.com' },
  items: [],
  total: 1,
}
const again = await notifyOrderCreated(order, 'he')
console.log(`DEDUP_ADMIN=${again.admin.status} ID=${again.admin.providerMessageId || ''}`)
console.log(`DEDUP_CUSTOMER=${again.customer.status} ID=${again.customer.providerMessageId || ''}`)
for (const lang of ['he', 'ar', 'en']) {
  const preview = previewEmail('test', lang)
  const dir = preview.html.includes('dir="rtl"') ? 'rtl' : preview.html.includes('dir="ltr"') ? 'ltr' : '?'
  console.log(`PREVIEW_${lang.toUpperCase()}=${dir}`)
}
