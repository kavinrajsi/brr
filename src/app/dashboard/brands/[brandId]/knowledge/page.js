'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { apiCall } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

function DocForm({ existing, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    content: existing?.content ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.content.trim()) { setError('Content is required'); return }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-blue-200 rounded-xl p-5 bg-blue-50 space-y-4">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Label className="text-xs">Title *</Label>
        <Input
          placeholder="e.g. Return Policy"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="mt-1 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">Content *</Label>
        <Textarea
          placeholder="Paste or type the knowledge document content…"
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          className="mt-1 text-sm min-h-[140px]"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

export default function KnowledgePage() {
  const { brandId } = useParams()
  const [docs, setDocs]           = useState([])
  const [brand, setBrand]         = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError]         = useState('')

  useEffect(() => {
    Promise.all([
      apiCall(`/api/brands/${brandId}/knowledge`),
      apiCall(`/api/brands/${brandId}`),
    ])
      .then(([d, b]) => { setDocs(d); setBrand(b) })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [brandId])

  const handleAdd = async (form) => {
    const result = await apiCall(`/api/brands/${brandId}/knowledge`, {
      method: 'POST',
      body: JSON.stringify(form),
    })
    setDocs(prev => [result, ...prev])
    setShowAddForm(false)
  }

  const handleEdit = async (docId, form) => {
    const result = await apiCall(`/api/brands/${brandId}/knowledge/${docId}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    })
    setDocs(prev => prev.map(d => d.id === docId ? result : d))
    setEditingId(null)
  }

  const handleDelete = async (docId) => {
    setDeletingId(docId)
    try {
      await apiCall(`/api/brands/${brandId}/knowledge/${docId}`, { method: 'DELETE' })
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading…</p></Card>
  }

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brand
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Knowledge Base</h1>
            {brand && <p className="text-slate-600 mt-1">{brand.name} — documents injected into agent context</p>}
          </div>
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)}>Add Document</Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6">
          <DocForm onSave={handleAdd} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {docs.length === 0 && !showAddForm ? (
        <Card className="p-12 text-center bg-slate-50">
          <p className="text-slate-500 text-sm">No knowledge documents yet.</p>
          <p className="text-slate-400 text-xs mt-1">Add documents to give your agent context — FAQs, policies, product details, etc.</p>
          <Button className="mt-4" onClick={() => setShowAddForm(true)}>Add your first document</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => {
            if (editingId === doc.id) {
              return (
                <DocForm
                  key={doc.id}
                  existing={doc}
                  onSave={(form) => handleEdit(doc.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              )
            }
            return (
              <div key={doc.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{doc.title}</p>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{doc.content}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Updated {new Date(doc.updated_at ?? doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setEditingId(doc.id)}>Edit</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDelete(doc.id)}
                    >
                      {deletingId === doc.id ? '…' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
