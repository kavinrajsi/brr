'use client'

import { useEffect, useRef, useState } from 'react'
import { streamChat } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarkdownView } from '@/components/ui/markdown-view'

export function ChatConsole({ agentId, title = 'Test Console', subtitle = 'Chat with your agent to verify its brand voice before going live.', heightClass = 'h-72', initialPrompt = '' }) {
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState(initialPrompt)
  const [sending, setSending]               = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const bottomRef                           = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setInput(initialPrompt)
  }, [initialPrompt])

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setSending(true)
    setMessages(prev => [...prev, { role: 'agent', text: '', streaming: true }])

    await streamChat(
      agentId,
      text,
      (token) => {
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'agent') updated[updated.length - 1] = { ...last, text: last.text + token }
          return updated
        })
      },
      ({ conversationId: cid }) => {
        if (cid && !conversationId) setConversationId(cid)
        setMessages(prev => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'agent') updated[updated.length - 1] = { ...last, streaming: false }
          return updated
        })
        setSending(false)
      },
      (err) => {
        setMessages(prev => {
          const without = prev.filter((m, i) => !(i === prev.length - 1 && m.streaming))
          return [...without, { role: 'error', text: err.message }]
        })
        setSending(false)
      },
      conversationId,
    )
  }

  const reset = () => {
    setMessages([])
    setConversationId(null)
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-bold text-slate-900 mb-1">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {messages.length > 0 && (
          <Button size="sm" variant="outline" onClick={reset}>Reset</Button>
        )}
      </div>

      <div className={`${heightClass} overflow-y-auto border border-slate-200 rounded-lg p-4 mb-3 space-y-3 bg-slate-50`}>
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center mt-24">Send a message to test the agent</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
              m.role === 'user'  ? 'bg-slate-900 text-white rounded-br-none whitespace-pre-wrap' :
              m.role === 'agent' ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-none' :
              'bg-red-50 border border-red-200 text-red-700 whitespace-pre-wrap'
            }`}>
              {m.role === 'agent'
                ? <MarkdownView>{m.text}</MarkdownView>
                : m.text
              }
              {m.streaming && <span className="inline-block animate-pulse ml-0.5 text-slate-400">▌</span>}
            </div>
          </div>
        ))}
        {sending && messages[messages.length - 1]?.role !== 'agent' && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-xl rounded-bl-none px-4 py-2 text-slate-400 text-sm">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Type a test message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={sending}
        />
        <Button onClick={send} disabled={sending || !input.trim()}>Send</Button>
      </div>
    </Card>
  )
}
