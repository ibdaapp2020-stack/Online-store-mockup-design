import { db } from '../db.mjs'

const DEFAULT_FLAGS = {
  newOrder: true,
  paymentReceived: true,
  paymentProblem: true,
  orderCancelled: true,
  lowStock: true,
  outOfStock: true,
  systemAlerts: true,
}

export function ensureEmailSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_deliveries (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      subject TEXT,
      status TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_message_id TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      sent_at TEXT,
      failed_at TEXT,
      error_code TEXT,
      html TEXT,
      text_body TEXT
    );
    CREATE TABLE IF NOT EXISTS email_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  for (const column of ['html TEXT', 'text_body TEXT']) {
    try {
      db.exec(`ALTER TABLE email_deliveries ADD COLUMN ${column}`)
    } catch {
      /* already exists */
    }
  }
}

function now() {
  return new Date().toISOString()
}

function id() {
  return `mail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function notificationFlags() {
  ensureEmailSchema()
  const row = db.prepare('SELECT value FROM email_state WHERE key = ?').get('flags')
  return { ...DEFAULT_FLAGS, ...(row ? JSON.parse(row.value) : {}) }
}

export function saveNotificationFlags(next) {
  ensureEmailSchema()
  const flags = { ...DEFAULT_FLAGS, ...next }
  db.prepare('INSERT INTO email_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    'flags',
    JSON.stringify(flags),
  )
  return flags
}

export function getDelivery(key) {
  ensureEmailSchema()
  return db.prepare('SELECT * FROM email_deliveries WHERE idempotency_key = ?').get(key)
}

export function listDeliveries(limit = 80) {
  ensureEmailSchema()
  return db.prepare('SELECT * FROM email_deliveries ORDER BY created_at DESC LIMIT ?').all(limit)
}

export function getDeliveryById(deliveryId) {
  ensureEmailSchema()
  return db.prepare('SELECT * FROM email_deliveries WHERE id = ?').get(deliveryId)
}

export function upsertPending(input) {
  ensureEmailSchema()
  const existing = getDelivery(input.key)
  if (existing) {
    db.prepare('UPDATE email_deliveries SET status = ?, attempt_count = attempt_count + 1, error_code = NULL WHERE id = ?').run(
      'PENDING',
      existing.id,
    )
    return { ...existing, status: 'PENDING', attempt_count: existing.attempt_count + 1 }
  }
  const row = {
    id: id(),
    idempotency_key: input.key,
    type: input.type,
    recipient: input.recipient,
    entity_type: input.entityType || '',
    entity_id: input.entityId || '',
    subject: input.subject,
    status: 'PENDING',
    provider: 'BREVO',
    provider_message_id: '',
    attempt_count: 1,
    created_at: now(),
    sent_at: null,
    failed_at: null,
    error_code: null,
    html: input.html || '',
    text_body: input.text || '',
  }
  db.prepare(
    `INSERT INTO email_deliveries
      (id, idempotency_key, type, recipient, entity_type, entity_id, subject, status, provider, provider_message_id, attempt_count, created_at, sent_at, failed_at, error_code, html, text_body)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.idempotency_key,
    row.type,
    row.recipient,
    row.entity_type,
    row.entity_id,
    row.subject,
    row.status,
    row.provider,
    row.provider_message_id,
    row.attempt_count,
    row.created_at,
    row.sent_at,
    row.failed_at,
    row.error_code,
    row.html,
    row.text_body,
  )
  return row
}

export function markSent(key, messageId) {
  db.prepare('UPDATE email_deliveries SET status = ?, provider_message_id = ?, sent_at = ?, failed_at = NULL, error_code = NULL WHERE idempotency_key = ?').run(
    'SENT',
    messageId || '',
    now(),
    key,
  )
  return getDelivery(key)
}

export function markFailed(key, errorCode) {
  db.prepare('UPDATE email_deliveries SET status = ?, failed_at = ?, error_code = ? WHERE idempotency_key = ?').run('FAILED', now(), String(errorCode || 'SEND_FAILED').slice(0, 180), key)
  return getDelivery(key)
}

export function markSkipped(input) {
  ensureEmailSchema()
  const existing = getDelivery(input.key)
  if (existing) return existing
  const row = upsertPending(input)
  db.prepare('UPDATE email_deliveries SET status = ?, error_code = ? WHERE id = ?').run('SKIPPED', input.errorCode || 'SKIPPED', row.id)
  return getDelivery(input.key)
}

export function stockArmed(productId) {
  ensureEmailSchema()
  const row = db.prepare('SELECT value FROM email_state WHERE key = ?').get(`oos:${productId}`)
  return row ? row.value === 'armed' : true
}

export function setStockArmed(productId, armed) {
  ensureEmailSchema()
  db.prepare('INSERT INTO email_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    `oos:${productId}`,
    armed ? 'armed' : 'sent',
  )
}

export function mapDelivery(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    recipient: row.recipient,
    entityType: row.entity_type,
    entityId: row.entity_id,
    subject: row.subject,
    status: row.status,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    failedAt: row.failed_at,
    errorCode: row.error_code,
  }
}
