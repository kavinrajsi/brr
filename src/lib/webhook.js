import crypto from 'crypto'

const WEBHOOK_TIMEOUT_MS = 8000
const WEBHOOK_MAX_RETRIES = 2 // total attempts = 1 + retries on retriable errors

// SSRF guard — block the obvious internal targets. Run BEFORE any outbound
// fetch and BEFORE storing a webhook_url so a malicious user cannot point
// the platform at internal infrastructure (cloud metadata, RFC1918, etc.).
const BLOCKED_HOSTNAMES = new Set([
  'localhost', '0.0.0.0', '127.0.0.1', '::1',
  '169.254.169.254',           // AWS / GCP / Azure cloud-metadata
  'metadata.google.internal',  // GCP metadata
  'metadata',                  // common shorthand
])

function isBlockedIp(host) {
  // IPv4 RFC1918 + link-local + loopback
  const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (v4) {
    const [a, b] = [parseInt(v4[1], 10), parseInt(v4[2], 10)]
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 0)  return true
    return false
  }
  // IPv6: block loopback and link-local + private prefixes
  if (host.includes(':')) {
    const lower = host.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    if (lower.startsWith('fe80:'))  return true // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // unique-local
  }
  return false
}

export function validateWebhookUrl(rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: 'Webhook URL is not a valid URL' }
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Webhook URL must use https://' }
  }
  const host = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: 'Webhook URL points to a disallowed host' }
  }
  if (isBlockedIp(host)) {
    return { ok: false, error: 'Webhook URL points to a private or loopback IP' }
  }
  return { ok: true, url }
}

async function fetchWithTimeout(url, init, ms) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function triggerHandoff(webhookUrl, webhookSecret, payload) {
  const validation = validateWebhookUrl(webhookUrl)
  if (!validation.ok) {
    console.warn(JSON.stringify({
      level: 'warn', event: 'webhook_url_blocked', reason: validation.error,
    }))
    return { ok: false, error: validation.error }
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify(payload)
  // Stripe-style signature: include timestamp in the signed string so receivers
  // can reject replays. Receiver verifies HMAC over `${t}.${body}`.
  const signed = `${timestamp}.${body}`
  const sig = crypto.createHmac('sha256', webhookSecret).update(signed).digest('hex')

  let lastErr
  for (let attempt = 0; attempt <= WEBHOOK_MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BRR-Timestamp': String(timestamp),
          'X-BRR-Signature': `t=${timestamp},v1=${sig}`,
        },
        body,
      }, WEBHOOK_TIMEOUT_MS)

      if (res.ok) return { ok: true, status: res.status }
      // Don't retry on 4xx — receiver said no
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, error: `Receiver returned ${res.status}` }
      }
      lastErr = new Error(`Receiver returned ${res.status}`)
    } catch (err) {
      lastErr = err
    }
    // Exponential backoff between attempts
    if (attempt < WEBHOOK_MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 250 * Math.pow(2, attempt)))
    }
  }

  console.warn(JSON.stringify({
    level: 'warn', event: 'webhook_delivery_failed',
    error: lastErr?.message, attempts: WEBHOOK_MAX_RETRIES + 1,
  }))
  return { ok: false, error: lastErr?.message ?? 'Delivery failed' }
}
