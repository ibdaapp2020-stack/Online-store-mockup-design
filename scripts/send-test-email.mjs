import { initDb, loadEnv } from '../server/db.mjs'
import { sendTestEmail } from '../server/email/service.mjs'

loadEnv()
await initDb()

const to = process.argv[2] || 'abulieltasneem23@gmail.com'
const result = await sendTestEmail(to, 'he')
console.log(`TEST_EMAIL=${result.status}`)
console.log(`RECIPIENT=${to}`)
console.log(`BREVO_MESSAGE_ID=${result.providerMessageId || ''}`)
if (result.errorCode) console.log(`ERROR=${result.errorCode}`)
if (result.status !== 'SENT') process.exitCode = 1
