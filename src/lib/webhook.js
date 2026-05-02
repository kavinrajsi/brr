import crypto from 'crypto'

export async function triggerHandoff(webhookUrl, webhookSecret, payload) {
  const body = JSON.stringify(payload)
  const sig = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex')

  await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BRR-Signature': `sha256=${sig}`,
    },
    body,
  })
}
