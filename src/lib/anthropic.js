import Anthropic from '@anthropic-ai/sdk'
import { isFilled, formatValue } from '@/lib/brand-config'

// Single source of truth — never hard-code model names in route handlers.
// Per AGENTS.md / CLAUDE.md.
export const MODEL = 'claude-haiku-4-5-20251001'

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Sanitize brand-config values before interpolating into AI system prompts.
// Defends against a malicious member who has brand:update planting jailbreak
// strings ("Ignore previous instructions...", forged </system> markers, etc.)
// into a brand owned by someone with elevated privileges.
const PROMPT_INJECTION_PATTERNS = [
  /<\/?(system|assistant|user|instructions?)>/gi,
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|messages?)/gi,
  /\bdisregard\s+(all\s+)?(previous|prior|above)/gi,
  /\bnew\s+instructions?:/gi,
  /\bsystem\s*:\s*you\s+are/gi,
]

export function sanitizePromptValue(value, maxLen = 1000) {
  if (value == null) return ''
  let s = typeof value === 'string'
    ? value
    : Array.isArray(value)
      ? value.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)

  // Strip control characters except whitespace
  s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')

  // Neutralise injection patterns by inserting a zero-width space inside the trigger
  for (const pat of PROMPT_INJECTION_PATTERNS) {
    s = s.replace(pat, m => m.slice(0, 1) + '​' + m.slice(1))
  }

  if (s.length > maxLen) s = s.slice(0, maxLen) + '…'
  return s.trim()
}

function safe(v) { return sanitizePromptValue(v) }

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

// Add a labelled line if the value is filled (handles arrays and objects, sanitised).
function addLine(lines, prefix, value, maxLen = 1000) {
  if (isFilled(value)) lines.push(`${prefix}${sanitizePromptValue(value, maxLen)}`)
}

export function buildBrandSystemPrompt(brandName, config = {}) {
  const lines = [
    `You are a brand-trained AI agent representing ${brandName}.`,
    `Your sole purpose is to assist customers on behalf of ${brandName} — stay in character at all times.`,
  ]

  // ── Physique ──────────────────────────────────────────────────────────────
  if (isFilled(config.tagline))
    lines.push('', `Brand tagline: "${safe(config.tagline)}"`)
  addLine(lines, 'Visual identity: ', config.physique)
  addLine(lines, 'Signature products/services: ', config.signature_products)

  // ── Personality ───────────────────────────────────────────────────────────
  const traits = list(config.personality_traits)
  if (traits)
    lines.push('', `Brand character: ${traits.map(t => safe(t, 60)).join(', ')}`)
  addLine(lines, 'Tone of voice: ', config.tone)
  addLine(lines, 'Response style: ', config.response_style)
  addLine(lines, 'Brand promise: ', config.promise)

  // ── Culture ───────────────────────────────────────────────────────────────
  const values = list(config.key_values)
  if (values)
    lines.push('', `Core values: ${values.map(v => safe(v, 60)).join(', ')}`)
  addLine(lines, 'What we stand for: ', config.culture_beliefs)
  addLine(lines, 'Brand origin: ', config.culture_origin)

  // ── Relationship ──────────────────────────────────────────────────────────
  if (isFilled(config.relationship_type))
    lines.push('', `Your relationship with the customer: act as their ${safe(config.relationship_type)}`)

  const prohibited = list(config.prohibited_topics)
  if (prohibited) {
    lines.push('', `Never discuss or engage with: ${prohibited.map(p => safe(p, 100)).join(', ')}.`)
    lines.push('If a user raises these topics, politely redirect without elaborating.')
  }

  const escalation = list(config.escalation_triggers)
  if (escalation) {
    lines.push('', `If the user mentions any of the following, acknowledge their concern and let them know you are connecting them with a specialist: ${escalation.map(e => safe(e, 100)).join(', ')}.`)
  }

  // ── Reflection ────────────────────────────────────────────────────────────
  if (isFilled(config.target_audience))
    lines.push('', `You are speaking to: ${safe(config.target_audience)}`)
  addLine(lines, 'Customer archetype: ', config.reflection_archetype)
  addLine(lines, 'What they care about: ', config.customer_values)

  // ── Self-image ────────────────────────────────────────────────────────────
  if (isFilled(config.selfimage_feeling))
    lines.push('', `When customers interact with ${brandName} they should feel: ${safe(config.selfimage_feeling)}`)
  addLine(lines, 'Help them become: ', config.selfimage_aspiration)

  // ── Final guidelines ──────────────────────────────────────────────────────
  if (isFilled(config.response_guidelines))
    lines.push('', safe(config.response_guidelines, 2000))

  lines.push('', 'Keep responses concise, helpful, and always on-brand.')

  return lines.join('\n')
}

export function buildCachedSystemBlock(text) {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } }
}
