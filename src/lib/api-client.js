'use client'

import { supabase } from './supabase'

async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

// `signal` is an AbortSignal — pass one from a hook so that unmounting the
// component cancels the in-flight request. fetch() rejects with AbortError
// when the signal is aborted; callers can detect it via err.name === 'AbortError'.
export async function apiCall(endpoint, options = {}) {
  const token = await getAuthToken()

  // Don't send "Authorization: Bearer undefined" when there's no session —
  // some routes branch on the header's presence and would treat the literal
  // string "undefined" as an invalid token instead of an unauthenticated call.
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(endpoint, { ...options, headers })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `Request failed: ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

// True when an error came from an aborted fetch (component unmount, route
// change). Hook fetch effects use this to skip setState after teardown.
export function isAbortError(err) {
  return err?.name === 'AbortError'
}

export async function streamChat(agentId, message, onChunk, onDone, onError, conversationId) {
  let token
  try {
    token = await getAuthToken()
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return
  }

  if (!token) {
    onError?.(new Error('Not signed in'))
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
