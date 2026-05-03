import Anthropic from '@anthropic-ai/sdk'
import { isFilled, formatValue } from '@/lib/brand-config'

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Normalise a config field to a list of trimmed strings, or null if empty.
// Accepts both arrays (DB-native JSONB) and comma-separated strings.
function list(value) {
  if (Array.isArray(value)) {
    const items = value.map(v => String(v).trim()).filter(Boolean)
    return items.length ? items : null
  }
  if (!value) return null
  const items = String(value).split(',').map(s => s.trim()).filter(Boolean)
  return items.length ? items : null
}

// Add a labelled line if the value is filled (handles arrays and objects).
function addLine(lines, prefix, value) {
  if (isFilled(value)) lines.push(`${prefix}${formatValue(value)}`)
}

export function buildBrandSystemPrompt(brandName, config = {}) {
  const lines = [
    `You are a brand-trained AI agent representing ${brandName}.`,
    `Your sole purpose is to assist customers on behalf of ${brandName} — stay in character at all times.`,
  ]

  // ── Physique ──────────────────────────────────────────────────────────────
  if (isFilled(config.tagline))
    lines.push('', `Brand tagline: "${formatValue(config.tagline)}"`)
  addLine(lines, 'Visual identity: ', config.physique)
  addLine(lines, 'Signature products/services: ', config.signature_products)

  // ── Personality ───────────────────────────────────────────────────────────
  const traits = list(config.personality_traits)
  if (traits)
    lines.push('', `Brand character: ${traits.join(', ')}`)
  addLine(lines, 'Tone of voice: ', config.tone)
  addLine(lines, 'Response style: ', config.response_style)
  addLine(lines, 'Brand promise: ', config.promise)

  // ── Culture ───────────────────────────────────────────────────────────────
  const values = list(config.key_values)
  if (values)
    lines.push('', `Core values: ${values.join(', ')}`)
  addLine(lines, 'What we stand for: ', config.culture_beliefs)
  addLine(lines, 'Brand origin: ', config.culture_origin)

  // ── Relationship ──────────────────────────────────────────────────────────
  if (isFilled(config.relationship_type))
    lines.push('', `Your relationship with the customer: act as their ${formatValue(config.relationship_type)}`)

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
  if (isFilled(config.target_audience))
    lines.push('', `You are speaking to: ${formatValue(config.target_audience)}`)
  addLine(lines, 'Customer archetype: ', config.reflection_archetype)
  addLine(lines, 'What they care about: ', config.customer_values)

  // ── Self-image ────────────────────────────────────────────────────────────
  if (isFilled(config.selfimage_feeling))
    lines.push('', `When customers interact with ${brandName} they should feel: ${formatValue(config.selfimage_feeling)}`)
  addLine(lines, 'Help them become: ', config.selfimage_aspiration)

  // ── Final guidelines ──────────────────────────────────────────────────────
  if (isFilled(config.response_guidelines))
    lines.push('', formatValue(config.response_guidelines))

  lines.push('', 'Keep responses concise, helpful, and always on-brand.')

  return lines.join('\n')
}

export function buildCachedSystemBlock(text) {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } }
}
