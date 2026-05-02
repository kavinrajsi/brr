import Anthropic from '@anthropic-ai/sdk'

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Split a comma-separated config field into a trimmed array, or return null.
function list(value) {
  if (!value) return null
  const items = String(value).split(',').map(s => s.trim()).filter(Boolean)
  return items.length ? items : null
}

export function buildBrandSystemPrompt(brandName, config = {}) {
  const lines = [
    `You are a brand-trained AI agent representing ${brandName}.`,
    `Your sole purpose is to assist customers on behalf of ${brandName} — stay in character at all times.`,
  ]

  // ── Physique ──────────────────────────────────────────────────────────────
  if (config.tagline)
    lines.push('', `Brand tagline: "${config.tagline}"`)
  if (config.physique)
    lines.push(`Visual identity: ${config.physique}`)
  if (config.signature_products)
    lines.push(`Signature products/services: ${config.signature_products}`)

  // ── Personality ───────────────────────────────────────────────────────────
  const traits = list(config.personality_traits)
  if (traits)
    lines.push('', `Brand character: ${traits.join(', ')}`)
  if (config.tone)
    lines.push(`Tone of voice: ${config.tone}`)
  if (config.response_style)
    lines.push(`Response style: ${config.response_style}`)
  if (config.promise)
    lines.push(`Brand promise: ${config.promise}`)

  // ── Culture ───────────────────────────────────────────────────────────────
  const values = list(config.key_values)
  if (values)
    lines.push('', `Core values: ${values.join(', ')}`)
  if (config.culture_beliefs)
    lines.push(`What we stand for: ${config.culture_beliefs}`)
  if (config.culture_origin)
    lines.push(`Brand origin: ${config.culture_origin}`)

  // ── Relationship ──────────────────────────────────────────────────────────
  if (config.relationship_type)
    lines.push('', `Your relationship with the customer: act as their ${config.relationship_type}`)

  const prohibited = list(config.prohibited_topics)
  if (prohibited) {
    lines.push('', `Never discuss or engage with: ${prohibited.join(', ')}.`)
    lines.push('If a user raises these topics, politely redirect without elaborating.')
  }

  const escalation = list(config.escalation_triggers)
  if (escalation) {
    lines.push('', `If the user mentions any of the following, acknowledge their concern and let them know you are connecting them with a specialist: ${escalation.join(', ')}.`)
  }

  // ── Reflection ────────────────────────────────────────────────────────────
  if (config.target_audience)
    lines.push('', `You are speaking to: ${config.target_audience}`)
  if (config.reflection_archetype)
    lines.push(`Customer archetype: ${config.reflection_archetype}`)
  if (config.customer_values)
    lines.push(`What they care about: ${config.customer_values}`)

  // ── Self-image ────────────────────────────────────────────────────────────
  if (config.selfimage_feeling)
    lines.push('', `When customers interact with ${brandName} they should feel: ${config.selfimage_feeling}`)
  if (config.selfimage_aspiration)
    lines.push(`Help them become: ${config.selfimage_aspiration}`)

  // ── Final guidelines ──────────────────────────────────────────────────────
  if (config.response_guidelines)
    lines.push('', config.response_guidelines)

  lines.push('', 'Keep responses concise, helpful, and always on-brand.')

  return lines.join('\n')
}
