'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'

// Read the embed token from the URL fragment (#token=...) — fragments are
// not sent in HTTP requests, do not appear in server logs, and are not
// forwarded in Referer headers from sub-resource fetches. We immediately
// strip it from the URL bar with history.replaceState so it does not leak
// via screen-share or browser history beyond the initial page load.
function readAndStripToken() {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash) return null
  const params = new URLSearchParams(hash.slice(1))
  const token = params.get('token')
  if (!token) return null
  // Replace the URL with a clean version (no fragment) without adding history
  try {
    const clean = window.location.pathname + window.location.search
    window.history.replaceState(null, '', clean)
  } catch {}
  return token
}

// The parent page's origin (when embedded as iframe). For top-level loads
// this is the empty string. The chat route requires this header for embed
// tokens and matches it against the token's allowed_origin.
function getParentOrigin() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''
  // document.referrer is the parent's full URL when loaded as a cross-origin
  // iframe. Same-origin iframes also expose it. Strip path/query down to origin.
  const ref = document.referrer
  if (!ref) return ''
  try {
    const u = new URL(ref)
    const port = u.port && u.port !== '443' ? `:${u.port}` : ''
    return `${u.protocol}//${u.hostname}${port}`
  } catch {
    return ''
  }
}

function EmbedWidget() {
  const { agentId } = useParams()
  const [token, setToken] = useState(null)
  const [parentOrigin, setParentOrigin] = useState('')
  const [ready, setReady] = useState(false)

  const [messages, setMessages]               = useState([])
  const [input, setInput]                     = useState('')
  const [sending, setSending]                 = useState(false)
  const [conversationId, setConversationId]   = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    setToken(readAndStripToken())
    setParentOrigin(getParentOrigin())
    setReady(true)
  }, [])

  // Throttle the auto-scroll to one frame. Without this, every streaming
  // token (often dozens per second) would queue a smooth-scroll animation,
  // pegging the main thread and causing visible jank during long replies.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [messages, sending])

  if (!ready) return null

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center p-8 max-w-sm">
          <p className="font-semibold text-slate-900 mb-1">Configuration error</p>
          <p className="text-sm text-slate-500">
            This widget is missing an embed token. Add{' '}
            <code className="font-mono bg-slate-100 px-1 rounded">#token=YOUR_EMBED_TOKEN</code>{' '}
            to the URL fragment.
          </p>
        </div>
      </div>
    )
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setSending(true)
    setMessages(prev => [...prev, { role: 'agent', text: '', streaming: true }])

    try {
      const body = { message: text }
      if (conversationId) body.conversationId = conversationId

      const res = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // The chat route checks this against the token's allowed_origin
          'X-Embed-Origin': parentOrigin,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `Request failed`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data: '))
          if (!dataLine) continue
          let event
          try { event = JSON.parse(dataLine.slice(6)) } catch { continue }

          if (event.type === 'delta') {
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'agent') updated[updated.length - 1] = { ...last, text: last.text + event.text }
              return updated
            })
          } else if (event.type === 'done') {
            if (event.conversationId && !conversationId) setConversationId(event.conversationId)
            setMessages(prev => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.role === 'agent') updated[updated.length - 1] = { ...last, streaming: false }
              return updated
            })
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const withoutPlaceholder = prev.filter((m, i) => !(i === prev.length - 1 && m.streaming))
        return [...withoutPlaceholder, { role: 'error', text: err.message }]
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Assistant</p>
          <p className="text-xs text-slate-400">Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center mt-12">Send a message to start chatting</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
              m.role === 'user'  ? 'bg-blue-600 text-white rounded-br-sm' :
              m.role === 'agent' ? 'bg-slate-100 text-slate-800 rounded-bl-sm' :
              'bg-red-50 border border-red-200 text-red-700 rounded-bl-sm'
            }`}>
              {m.text}
              {m.streaming && <span className="inline-block animate-pulse ml-0.5 text-slate-400">▌</span>}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.role !== 'agent' && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[40px] max-h-32"
            placeholder="Type a message…"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            disabled={sending}
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-1.5 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-300">Powered by <span className="font-medium text-slate-400">BRR AI</span></p>
      </div>
    </div>
  )
}

export default function EmbedPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-white">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    }>
      <EmbedWidget />
    </Suspense>
  )
}
