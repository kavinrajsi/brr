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
    try {
      await apiCall(`/api/agents/${agentId}/keys/${keyId}`, { method: 'DELETE' })
      setKeys(prev => prev.filter(k => k.id !== keyId))
      removeKeyFromSession(keyId)
      if (revealed?.id === keyId) setRevealed(null)
    } catch (err) {
      alert('Failed to revoke key: ' + err.message)
    }
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

function StageRow({ stage, href }) {
  return <StageCard stage={stage} href={href} />
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
