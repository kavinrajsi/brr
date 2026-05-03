'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTraining } from '@/hooks/useTraining'
import { apiCall } from '@/lib/api-client'
import { StageCard } from '@/components/training/StageCard'
import { ChatConsole } from '@/components/training/ChatConsole'
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
//
// Plaintext API keys are returned by the server EXACTLY ONCE on creation.
// Previously we cached them in sessionStorage so users could re-show them,
// but any XSS on the dashboard could exfiltrate every key. Now: copy at
// creation time, or revoke and create a new one.

function ApiKeyManager({ agentId }) {
  const [keys, setKeys]             = useState([])
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating]     = useState(false)
  const [revealed, setRevealed]     = useState(null) // { id, key } — only the just-created key
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
      // Show the plaintext key once in the UI; do NOT persist it anywhere
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
    try {
      await apiCall(`/api/agents/${agentId}/keys/${keyId}`, { method: 'DELETE' })
      setKeys(prev => prev.filter(k => k.id !== keyId))
      if (revealed?.id === keyId) setRevealed(null)
    } catch (err) {
      alert('Failed to revoke key: ' + err.message)
    }
  }

  return (
    <Card className="p-6 mt-8">
      <h2 className="font-bold text-slate-900 mb-1">API Keys</h2>
      <p className="text-sm text-slate-500 mb-5">Use these keys to call the agent from your own tools. The full key is shown <span className="font-medium">only once</span> at creation — copy it immediately.</p>

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
          {keys.map(k => (
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
          ))}
        </div>
      )}
    </Card>
  )
}

function StageRow({ stage, href }) {
  return <StageCard stage={stage} href={href} />
}

// ─── Embed Widget Section ─────────────────────────────────────────────────────
// Embed tokens are origin-bound: each token can only be used from the
// allowed_origin you specify when creating it. The token itself rides in
// the URL fragment (#token=...) so it never appears in HTTP logs / Referer
// headers, and the widget strips it from the URL bar after reading.

function EmbedTokenManager({ agentId }) {
  const [tokens, setTokens]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [name, setName]             = useState('')
  const [origin, setOrigin]         = useState('https://')
  const [creating, setCreating]     = useState(false)
  const [revealed, setRevealed]     = useState(null)
  const [error, setError]           = useState('')
  const [copied, setCopied]         = useState(false)
  // Read window.location.origin in an effect — referencing window during the
  // initial render produces a hydration mismatch (server renders the
  // placeholder, client renders the real origin).
  const [appOrigin, setAppOrigin] = useState('https://your-domain.com')
  useEffect(() => { setAppOrigin(window.location.origin) }, [])

  useEffect(() => {
    apiCall(`/api/agents/${agentId}/embed-tokens`)
      .then(r => setTokens(r.tokens))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [agentId])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const created = await apiCall(`/api/agents/${agentId}/embed-tokens`, {
        method: 'POST',
        body: JSON.stringify({ name: name || 'Embed', allowed_origin: origin }),
      })
      setTokens(prev => [created, ...prev])
      setRevealed({ id: created.id, token: created.token, allowed_origin: created.allowed_origin })
      setName('')
      setOrigin('https://')
      setShowForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (tokenId) => {
    if (!confirm('Revoke this embed token? Any site using it will stop working.')) return
    try {
      await apiCall(`/api/agents/${agentId}/embed-tokens/${tokenId}`, { method: 'DELETE' })
      setTokens(prev => prev.filter(t => t.id !== tokenId))
      if (revealed?.id === tokenId) setRevealed(null)
    } catch (err) {
      alert('Failed to revoke: ' + err.message)
    }
  }

  const snippet = revealed
    ? `<iframe\n  src="${appOrigin}/embed/${agentId}#token=${revealed.token}"\n  width="400"\n  height="600"\n  style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);"\n></iframe>`
    : null

  return (
    <Card className="p-6 mt-8">
      <h2 className="font-bold text-slate-900 mb-1">Embed Widget</h2>
      <p className="text-sm text-slate-500 mb-5">
        Drop the chat widget into any webpage. Each embed token is{' '}
        <span className="font-medium">bound to a single origin</span> — even if
        the token is intercepted, it cannot be used from another site.
      </p>

      {!showForm && !revealed && (
        <Button onClick={() => setShowForm(true)} className="mb-5">+ Create Embed Token</Button>
      )}

      {showForm && (
        <div className="border border-slate-200 rounded-lg p-4 mb-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Name</label>
            <Input
              placeholder="e.g. Marketing Site"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={creating}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Allowed Origin</label>
            <Input
              placeholder="https://example.com"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              disabled={creating}
            />
            <p className="text-xs text-slate-400 mt-1">Exact origin only. No path or query — just <code className="font-mono">https://example.com</code>.</p>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={creating || !origin.trim()}>
              {creating ? 'Creating…' : 'Create Token'}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setError('') }} disabled={creating}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <p className="text-xs font-semibold text-amber-800">
            Copy this snippet now — the embed token is shown only once.
          </p>
          <p className="text-xs text-amber-700">Bound to <span className="font-mono font-medium">{revealed.allowed_origin}</span></p>
          <div className="relative">
            <pre className="text-xs bg-slate-900 text-green-400 rounded p-3 overflow-x-auto whitespace-pre">{snippet}</pre>
            <Button
              size="sm" variant="outline"
              className="absolute top-2 right-2 text-xs bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700"
              onClick={() => navigator.clipboard.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRevealed(null)}>Done</Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-slate-400">No embed tokens yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {tokens.map(t => (
            <div key={t.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500 truncate">{t.allowed_origin}</p>
                <p className="text-xs text-slate-400 font-mono">{t.token_prefix}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {t.last_used_at && (
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Last used {new Date(t.last_used_at).toLocaleDateString()}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleRevoke(t.id)}
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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

  // Same hydration-safe pattern as the embed token manager — window.location
  // is undefined on the server and would mismatch on the client.
  const [appOrigin, setAppOrigin] = useState('')
  useEffect(() => { setAppOrigin(window.location.origin) }, [])

  useEffect(() => {
    let cancelled = false
    apiCall(`/api/agents/${agentId}`)
      .then(a => { if (!cancelled) setAgent(a) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAgentLoading(false) })
    return () => { cancelled = true }
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

      {/* Stage list */}
      <div className="space-y-2">
        {stages.map(stage => (
          <StageRow
            key={stage.stage}
            stage={stage}
            href={
              stage.status !== 'Pending'
                ? `/dashboard/brands/${brandId}/agents/${agentId}/stage/${stage.stage}`
                : undefined
            }
          />
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
          <div className="mt-8">
            <ChatConsole agentId={agentId} />
          </div>
          <ApiKeyManager agentId={agentId} />
          <EmbedTokenManager agentId={agentId} />

          <Card className="p-6 mt-8 bg-slate-50">
            <h2 className="font-bold text-slate-900 mb-1">Integration</h2>
            <p className="text-sm text-slate-600 mb-4">Call your agent from any tool using a generated API key.</p>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">REST API</p>
            <pre className="text-xs bg-slate-900 text-green-400 rounded-lg p-4 overflow-x-auto mb-5">{`curl -X POST ${appOrigin}/api/agents/${agentId}/chat \\
  -H "Authorization: Bearer <your-api-key>" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello, I need help with my order"}'`}</pre>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Claude.ai / MCP Server</p>
            <p className="text-sm text-slate-600 mb-2">
              Add this URL in <strong>claude.ai → Settings → Integrations → Add MCP Server</strong>:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 font-mono break-all">
                {appOrigin}/api/mcp
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(`${appOrigin}/api/mcp`)}
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
