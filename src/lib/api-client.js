'use client'

import { supabase } from './supabase'

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

export async function apiCall(endpoint, options = {}) {
  const token = await getAuthToken()

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

export async function streamChat(agentId, message, onChunk, onDone, onError, conversationId) {
  let token
  try {
    token = await getAuthToken()
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return
  }

  let response
  try {
    response = await fetch(`/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, conversationId }),
    })
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    onError?.(new Error(payload.error || `Request failed: ${response.status}`))
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''

      for (const part of parts) {
        const dataLine = part.split('\n').find(line => line.startsWith('data: '))
        if (!dataLine) continue

        let event
        try { event = JSON.parse(dataLine.slice(6)) } catch { continue }

        if (event.type === 'delta' && typeof event.text === 'string') {
          onChunk(event.text)
        } else if (event.type === 'done') {
          onDone({ escalation: Boolean(event.escalation), conversationId: event.conversationId })
        } else if (event.type === 'error') {
          onError?.(new Error(event.error ?? 'Stream error'))
        }
      }
    }
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
  } finally {
    reader.releaseLock()
  }
}
