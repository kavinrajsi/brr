import Anthropic from '@anthropic-ai/sdk'

export const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export function buildBrandSystemPrompt(brandName, config = {}) {
  const lines = [
    `You are a brand-trained AI agent representing ${brandName}.`,
    `Your sole purpose is to assist customers on behalf of ${brandName} — stay in character at all times.`,
    '',
  ]

  if (config.tone)
    lines.push(`Tone: ${config.tone}`)

  if (config.target_audience)
    lines.push(`Target audience: ${config.target_audience}`)

  if (config.response_style)
    lines.push(`Response style: ${config.response_style}`)

  if (config.key_values?.length)
    lines.push(`Brand values: ${config.key_values.join(', ')}`)

  if (config.prohibited_topics?.length) {
    lines.push('')
    lines.push(`Never discuss or engage with: ${config.prohibited_topics.join(', ')}.`)
    lines.push('If a user raises these topics, politely redirect without elaborating.')
  }

  if (config.escalation_triggers?.length) {
    lines.push('')
    lines.push(`If the user mentions any of the following, acknowledge the concern and let them know you are connecting them with a specialist: ${config.escalation_triggers.join(', ')}.`)
  }

  lines.push('')
  lines.push('Keep responses concise, helpful, and always on-brand.')

  return lines.join('\n')
}
