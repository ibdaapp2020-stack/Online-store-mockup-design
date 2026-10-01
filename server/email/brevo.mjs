import { emailConfig } from './config.mjs'

export async function brevoAccount() {
  const config = emailConfig()
  if (!config.apiKey) return { ok: false, error: 'BREVO_API_KEY missing' }
  const response = await fetch(`${config.baseUrl}/account`, {
    headers: { accept: 'application/json', 'api-key': config.apiKey },
  })
  if (!response.ok) {
    return { ok: false, error: `Brevo account ${response.status}` }
  }
  return { ok: true }
}

export async function brevoSend({ to, toName, subject, html, text, tags }) {
  const config = emailConfig()
  if (!config.apiKey) throw Object.assign(new Error('BREVO_API_KEY missing'), { code: 'CONFIG' })
  const response = await fetch(`${config.baseUrl}/smtp/email`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': config.apiKey,
    },
    body: JSON.stringify({
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: to, name: toName || undefined }],
      replyTo: { email: config.replyTo, name: config.senderName },
      subject,
      htmlContent: html,
      textContent: text,
      tags: tags?.slice(0, 4),
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.message || `Brevo ${response.status}`)
    error.code = payload.code || String(response.status)
    throw error
  }
  return { messageId: payload.messageId || payload.messageIds?.[0] || '' }
}
