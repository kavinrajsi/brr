'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTraining } from '@/hooks/useTraining'
import { apiCall, streamChat } from '@/lib/api-client'
import { StageCard } from '@/components/training/StageCard'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

const STATUS_STYLES = {
  Training:  'bg-blue-100 text-blue-800',
  Certified: 'bg-green-100 text-green-800',
  Deployed:  'bg-purple-100 text-purple-800',
}

// ─── API Key Manager ──────────────────────────────────────────────────────────

const SESSION_KEY = 'brr_api_keys'

function saveKeyToSession(id, rawKey) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}')
    stored[id] = rawKey
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored))
  } catch {}
}

function getKeyFromSession(id) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}')
    return stored[id] ?? null
  } catch { return null }
}

function removeKeyFromSession(id) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '{}')
    delete stored[id]
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored))
  } catch {}
}

function ApiKeyManager({ agentId }) {
  const [keys, setKeys]             = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating]     = useState(false)
  const [revealed, setRevealed]     = useState(null) // { id, key }
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    apiCall(`/api/agents/${agentId}/keys`)
      .then(r => setKeys(r.keys))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [agentId])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const created = await apiCall(`/api/agents/${agentId}/keys`, {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName || 'Default' }),
      })
      setKeys(prev => [created, ...prev])
      saveKeyToSession(created.id, created.key)
      setRevealed({ id: created.id, key: created.key })
      setNewKeyName('')
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (keyId) => {
    if (!confirm('Revoke this key? Any integration using it will stop working.')) return
    await apiCall(`/api/agents/${agentId}/keys/${keyId}`, { method: 'DELETE' })
    setKeys(prev => prev.filter(k => k.id !== keyId))
    removeKeyFromSession(keyId)
    if (revealed?.id === keyId) setRevealed(null)
  }

  const handleShow = (keyId) => {
    if (revealed?.id === keyId) { setRevealed(null); return }
    const raw = getKeyFromSession(keyId)
    if (raw) setRevealed({ id: keyId, key: raw })
  }

  return (
    <Card className="p-6 mt-8">
      <h2 className="font-bold text-slate-900 mb-1">API Keys</h2>
      <p className="text-sm text-slate-500 mb-5">Use these keys to call the agent from your own tools.</p>

      {/* Create */}
      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Key name (e.g. Production)"
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Generate Key'}
        </Button>
      </div>

      {/* Revealed key banner */}
      {revealed && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-amber-800">
              {keys.find(k => k.id === revealed.id)?.name ?? 'API Key'}
            </p>
            <button
              onClick={() => setRevealed(null)}
              className="text-amber-500 hover:text-amber-800 text-xs"
            >
              Hide
            </button>
          </div>
          <code className="block text-xs bg-white border border-amber-200 rounded px-3 py-2 font-mono break-all select-all">
            {revealed.key}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 text-xs"
            onClick={() => navigator.clipboard.writeText(revealed.key)}
          >
            Copy
          </Button>
        </div>
      )}

      {/* Key list */}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-slate-400">No keys yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {keys.map(k => {
            const available = Boolean(getKeyFromSession(k.id))
            const isShowing = revealed?.id === k.id
            return (
              <div key={k.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{k.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{k.key_prefix}</p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  {k.last_used_at && (
                    <p className="text-xs text-slate-400 hidden sm:block">
                      Last used {new Date(k.last_used_at).toLocaleDateString()}
                    </p>
                  )}
                  {available ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleShow(k.id)}
                    >
                      {isShowing ? 'Hide' : 'Show'}
                    </Button>
                  ) : (
                    <span
                      className="text-xs text-slate-300 cursor-default select-none"
                      title="Key unavailable — revoke and generate a new one to view it"
                    >
                      Show
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleRevoke(k.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ─── Test Console ─────────────────────────────────────────────────────────────

function ChatConsole({ agentId }) {
  const [messages, setMessages]             = useState([])
  const [input, setInput]                   = useState('')
  const [sending, setSending]               = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const bottomRef                           = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

  return (
    <Card className="p-6 mt-8">
      <h2 className="font-bold text-slate-900 mb-1">Test Console</h2>
      <p className="text-sm text-slate-500 mb-4">Chat with your agent to verify its brand voice before going live.</p>

      <div className="h-72 overflow-y-auto border border-slate-200 rounded-lg p-4 mb-3 space-y-3 bg-slate-50">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center mt-24">Send a message to test the agent</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
              m.role === 'user'  ? 'bg-slate-900 text-white rounded-br-none' :
              m.role === 'agent' ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-none' :
              'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {m.text}
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

// ─── AI Evaluation ────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  if (score == null) return null
  const color = score >= 7 ? 'bg-green-100 text-green-800 border-green-200'
    : score >= 4 ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
    : 'bg-red-100 text-red-800 border-red-200'
  return <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full border ${color}`}>{score}/10</span>
}

function EvaluateButton({ agentId, stageNum }) {
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState('')
  const [open, setOpen]         = useState(true)

  const run = async () => {
    setLoading(true); setError(''); setResult(null); setOpen(true)
    try {
      setResult(await apiCall(`/api/agents/${agentId}/training/${stageNum}/evaluate`, { method: 'POST' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-2">
      <Button size="sm" variant="outline" className="w-full text-xs text-blue-700 border-blue-200 hover:bg-blue-50" onClick={run} disabled={loading}>
        {loading ? 'Evaluating…' : 'Evaluate with AI'}
      </Button>
      {error && <p className="mt-2 text-xs text-red-600 px-1">{error}</p>}
      {result && open && (
        <div className="mt-3 border border-slate-200 rounded-xl bg-white p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ScoreBadge score={result.score} />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${result.ready ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                {result.ready ? 'Ready' : 'Not yet ready'}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-700">Dismiss</button>
          </div>
          {result.recommendations?.length > 0 && (
            <ul className="space-y-1.5">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-slate-400 shrink-0">-</span>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result && !open && (
        <button onClick={() => setOpen(true)} className="mt-1 text-xs text-slate-400 hover:text-slate-700 w-full text-center">Show result</button>
      )}
    </div>
  )
}

// ─── Embed Widget Section ─────────────────────────────────────────────────────

function EmbedWidgetSection({ agentId }) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'
  const snippet = `<iframe\n  src="${origin}/embed/${agentId}?key=YOUR_API_KEY"\n  width="400"\n  height="600"\n  style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);"\n></iframe>`

  return (
    <Card className="p-6 mt-8 bg-slate-50">
      <h2 className="font-bold text-slate-900 mb-1">Embed Widget</h2>
      <p className="text-sm text-slate-600 mb-4">Drop this chat widget into any webpage. Visitors authenticate via the API key in the URL.</p>
      <ol className="text-sm text-slate-600 mb-4 space-y-1 list-decimal list-inside">
        <li>Generate an API key in the <span className="font-medium">API Keys</span> section above.</li>
        <li>Replace <code className="font-mono bg-slate-200 px-1 rounded text-xs">YOUR_API_KEY</code> with that key.</li>
        <li>Paste the snippet into your website HTML.</li>
      </ol>
      <div className="relative">
        <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-4 overflow-x-auto whitespace-pre">{snippet}</pre>
        <Button
          size="sm" variant="outline"
          className="absolute top-2 right-2 text-xs bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700"
          onClick={() => navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentTrainingPage() {
  const { brandId, agentId } = useParams()
  const { stages, isLoading: trainingLoading } = useTraining(agentId)
  const [agent, setAgent]       = useState(null)
  const [agentLoading, setAgentLoading] = useState(true)
  const [deploying, setDeploying]       = useState(false)
  const [deployError, setDeployError]   = useState('')

  const handleDeploy = async () => {
    setDeploying(true)
    setDeployError('')
    try {
      const updated = await apiCall(`/api/agents/${agentId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Deployed', deployed_at: new Date().toISOString() }),
      })
      setAgent(updated)
    } catch (err) {
      setDeployError(err.message)
    } finally {
      setDeploying(false)
    }
  }

  useEffect(() => {
    apiCall(`/api/agents/${agentId}`)
      .then(setAgent)
      .catch(() => {})
      .finally(() => setAgentLoading(false))
  }, [agentId])

  const isLoading = agentLoading || trainingLoading

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
  }

  if (!agent) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">Agent not found</p>
        <Link href={`/dashboard/brands/${brandId}/training`}>
          <Button variant="outline">Back to Training</Button>
        </Link>
      </Card>
    )
  }

  const progress = stages.length > 0
    ? Math.round((stages.filter(s => s.status === 'Complete').length / 6) * 100)
    : 0

  const isLive = agent.status === 'Deployed' || agent.status === 'Certified'

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}/training`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Training
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{agent.name}</h1>
            <p className="text-slate-600 mt-1">{agent.brands?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/dashboard/brands/${brandId}/agents/${agentId}/metrics`}>
              <Button variant="outline" size="sm">📊 Metrics</Button>
            </Link>
            <Link href={`/dashboard/brands/${brandId}/agents/${agentId}/analytics`}>
              <Button variant="outline" size="sm">Analytics</Button>
            </Link>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_STYLES[agent.status] ?? STATUS_STYLES.Training}`}>
              {agent.status}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">Overall Progress</p>
          <p className="text-sm font-bold text-slate-900">{progress}%</p>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Stage {agent.current_stage} of 6 — {stages.filter(s => s.status === 'Complete').length} stages complete
        </p>
      </Card>

      {/* Stage grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map(stage => (
          <div key={stage.stage}>
            <StageCard
              stage={stage}
              href={
                stage.status !== 'Pending'
                  ? `/dashboard/brands/${brandId}/agents/${agentId}/stage/${stage.stage}`
                  : undefined
              }
            />
            {stage.status === 'In Progress' && (
              <EvaluateButton agentId={agentId} stageNum={stage.stage} />
            )}
          </div>
        ))}
      </div>

      {agent.status === 'Certified' && (
        <Card className="mt-8 p-6 bg-green-50 border-green-200">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-bold text-green-900">Agent Certified!</p>
              <p className="text-sm text-green-700 mt-1">
                Certified on {new Date(agent.certified_at).toLocaleDateString()}. Ready to deploy.
              </p>
              {deployError && <p className="text-sm text-red-600 mt-2">{deployError}</p>}
            </div>
            <Button onClick={handleDeploy} disabled={deploying} className="bg-green-700 hover:bg-green-800 text-white">
              {deploying ? 'Deploying…' : 'Deploy Agent'}
            </Button>
          </div>
        </Card>
      )}

      {agent.status === 'Deployed' && (
        <Card className="mt-8 p-6 bg-purple-50 border-purple-200">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🚀</span>
            <div>
              <p className="font-bold text-purple-900">Agent Deployed</p>
              <p className="text-sm text-purple-700 mt-0.5">
                Live since {new Date(agent.deployed_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Test console + API keys — shown once certified or deployed */}
      {isLive && (
        <>
          <ChatConsole agentId={agentId} />
          <ApiKeyManager agentId={agentId} />
          <EmbedWidgetSection agentId={agentId} />

          <Card className="p-6 mt-8 bg-slate-50">
            <h2 className="font-bold text-slate-900 mb-1">Integration</h2>
            <p className="text-sm text-slate-600 mb-4">Call your agent from any tool using a generated API key.</p>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">REST API</p>
            <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-4 overflow-x-auto mb-5">{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : ''}/api/agents/${agentId}/chat \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello, I need help with my order"}'`}</pre>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Claude.ai / MCP Server</p>
            <p className="text-sm text-slate-600 mb-2">
              Add this URL in <strong>claude.ai → Settings → Integrations → Add MCP Server</strong>:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/mcp
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/mcp`)}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              When prompted for authentication, use your API key as the Bearer token.
              Claude will gain two tools: <code className="font-mono">list_agents</code> and <code className="font-mono">chat_with_agent</code>.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
