'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAgents } from '@/hooks/useAgents'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'

const STATUS_STYLES = {
  Training:  'bg-blue-100 text-blue-800',
  Certified: 'bg-green-100 text-green-800',
  Deployed:  'bg-purple-100 text-purple-800',
}

function AgentRow({ agent, brandId, onRename }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(agent.name)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startEdit = () => {
    setName(agent.name)
    setError('')
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setError('')
  }

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || trimmed === agent.name) { cancel(); return }
    setSaving(true)
    setError('')
    try {
      await onRename(agent.id, trimmed)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'Rename failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-6 flex-row items-center justify-between">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') save()
                  if (e.key === 'Escape') cancel()
                }}
                disabled={saving}
                autoFocus
                className="max-w-xs"
              />
              <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{agent.name}</p>
            <button
              onClick={startEdit}
              title="Rename agent"
              className="text-slate-400 hover:text-slate-700"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[agent.status] ?? STATUS_STYLES.Training}`}>
            {agent.status}
          </span>
          <span className="text-xs text-slate-500">Stage {agent.current_stage}/6</span>
        </div>
      </div>
      <Link href={`/dashboard/brands/${brandId}/agents/${agent.id}`}>
        <Button>Continue Training</Button>
      </Link>
    </Card>
  )
}

function CreateAgentForm({ defaultName, onCreate, onCancel }) {
  const [name, setName] = useState(defaultName)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name is required'); return }
    setCreating(true)
    setError('')
    try {
      await onCreate(trimmed)
    } catch (err) {
      setError(err.message || 'Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="p-6 space-y-3 border-blue-200 bg-blue-50">
      <p className="text-sm font-semibold text-slate-800">Name your new agent</p>
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder="e.g. Customer Support Agent"
          disabled={creating}
          autoFocus
          className="max-w-md"
        />
        <Button onClick={submit} disabled={creating || !name.trim()}>
          {creating ? 'Creating…' : 'Create Agent'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={creating}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </Card>
  )
}

export default function BrandTrainingPage() {
  const { brandId } = useParams()
  const { agents, isLoading, createAgent, updateAgent } = useAgents(brandId)
  const [brand, setBrand] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiCall(`/api/brands/${brandId}`).then(setBrand).catch(() => {})
  }, [brandId])

  const handleCreateAgent = async (name) => {
    setError('')
    try {
      await createAgent({ brand_id: brandId, name })
      setShowCreateForm(false)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const handleRename = async (agentId, newName) => {
    await updateAgent(agentId, { name: newName })
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brand
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">Training</h1>
        {brand && <p className="text-slate-600 mt-1">{brand.name}</p>}
      </div>

      {error && (
        <Card className="p-4 mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Card>
      )}

      {isLoading && (
        <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
      )}

      {!isLoading && agents.length === 0 && !showCreateForm && (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-900 font-semibold mb-2">No agent started yet</p>
          <p className="text-sm text-slate-500 mb-6">
            Create an agent to begin the 6-stage training program
          </p>
          <Button onClick={() => setShowCreateForm(true)}>
            Start Training
          </Button>
        </Card>
      )}

      {showCreateForm && (
        <div className="mb-4">
          <CreateAgentForm
            defaultName={brand ? `${brand.name} Agent` : ''}
            onCreate={handleCreateAgent}
            onCancel={() => { setShowCreateForm(false); setError('') }}
          />
        </div>
      )}

      {!isLoading && agents.length > 0 && (
        <div className="space-y-4">
          {agents.map(agent => (
            <AgentRow key={agent.id} agent={agent} brandId={brandId} onRename={handleRename} />
          ))}

          {!showCreateForm && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={() => setShowCreateForm(true)}>
                + Add Another Agent
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
