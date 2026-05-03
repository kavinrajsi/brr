// Brand config fields are JSONB — values can be string, array, object, or primitive.
// These helpers normalise anything to a sensible string for display and AI prompts.

export function isFilled(v) {
  if (v == null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.some(item => isFilled(item))
  if (typeof v === 'object') return Object.keys(v).length > 0
  return Boolean(v)
}

export function formatValue(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(item => typeof item === 'string' ? item : JSON.stringify(item)).join(', ')
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}
