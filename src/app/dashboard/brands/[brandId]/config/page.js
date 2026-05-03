'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useBrandConfig } from '@/hooks/useBrandConfig'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

// Kapferer's Brand Identity Prism — 6 facets
const STEPS = [
  {
    id: 1,
    facet: 'Physique',
    icon: '◻',
    subtitle: 'The brand\'s tangible characteristics — what it looks and feels like.',
  },
  {
    id: 2,
    facet: 'Personality',
    icon: '◇',
    subtitle: 'The brand\'s character traits, as if it were a person.',
  },
  {
    id: 3,
    facet: 'Culture',
    icon: '△',
    subtitle: 'The values, beliefs, and origin that drive the brand.',
  },
  {
    id: 4,
    facet: 'Relationship',
    icon: '○',
    subtitle: 'How the brand interacts with and treats its customers.',
  },
  {
    id: 5,
    facet: 'Reflection',
    icon: '▽',
    subtitle: 'The idealised image of the customer the brand projects.',
  },
  {
    id: 6,
    facet: 'Self-image',
    icon: '◁',
    subtitle: 'What customers feel about themselves when using the brand.',
  },
]

const LABEL_TO_KEY = {
  'Visual Identity': 'physique',
  'Tagline / Slogan': 'tagline',
  'Signature Products or Services': 'signature_products',
  'Character Traits': 'personality_traits',
  'Tone of Voice': 'tone',
  'Response Style': 'response_style',
  'Brand Promise / Soul': 'promise',
  'Core Values': 'key_values',
  'Beliefs & Principles': 'culture_beliefs',
  'Origin & Mission': 'culture_origin',
  'Relationship Type': 'relationship_type',
  'Escalation Triggers': 'escalation_triggers',
  'Prohibited Topics': 'prohibited_topics',
  'Webhook URL': 'webhook_url',
  'Target Audience': 'target_audience',
  'Customer Archetype': 'reflection_archetype',
  'Customer Values & Aspirations': 'customer_values',
  'How Customers Feel': 'selfimage_feeling',
  'Aspiration Fulfilled': 'selfimage_aspiration',
  'AI Response Guidelines': 'response_guidelines',
}

function parseBrandPrismMd(markdown) {
  const result = {}
  const regex = /\*\*(.+?):\*\*\s*([\s\S]*?)(?=\n\*\*|\n##|\n#\s|$)/g
  let match
  while ((match = regex.exec(markdown)) !== null) {
    const label = match[1].trim()
    const value = match[2].trim()
    const key = LABEL_TO_KEY[label]
    if (key && value) result[key] = value
  }
  return result
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  )
}

export default function BrandConfigPage() {
  const { brandId } = useParams()
  const { config, isLoading, error, isSaving, saveConfig } = useBrandConfig(brandId)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [savedData, setSavedData] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [importError, setImportError] = useState('')
  const [importCount, setImportCount] = useState(null)
  const importRef = useRef(null)

  useEffect(() => {
    if (config) {
      setFormData(config)
      setSavedData(config)
    }
  }, [config])

  const isDirty = JSON.stringify(formData) !== JSON.stringify(savedData)

  const set = (key, value) => setFormData(prev => ({ ...prev, [key]: value }))

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportError('')
    setImportCount(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseBrandPrismMd(ev.target.result)
      const count = Object.keys(parsed).length
      if (count === 0) {
        setImportError('No recognisable Brand Prism fields found in this file.')
        return
      }
      setFormData(prev => ({ ...prev, ...parsed }))
      setImportCount(count)
      setTimeout(() => setImportCount(null), 4000)
    }
    reader.readAsText(file)
  }

  const handleSave = async () => {
    setSaveError('')
    setSaveSuccess(false)
    try {
      await saveConfig(formData)
      setSavedData(formData)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading configuration…</p></Card>
  }

  if (error) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">{error}</p>
        <Link href={`/dashboard/brands/${brandId}`}>
          <Button variant="outline">Back to Brand</Button>
        </Link>
      </Card>
    )
  }

  const step = STEPS[currentStep - 1]

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brand
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Brand Prism</h1>
            <p className="text-slate-600 mt-1">Define your brand identity across Kapferer&apos;s six facets</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={importRef}
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={handleImport}
            />
            <Button variant="outline" onClick={() => importRef.current?.click()}>
              Import .md
            </Button>
            <Link href={`/dashboard/brands/${brandId}/prism`}>
              <Button variant="outline">View Brand Prism →</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(s.id)}
            className={[
              'flex-1 h-2 rounded-full transition-colors',
              i < currentStep - 1 ? 'bg-green-500' :
              i === currentStep - 1 ? 'bg-blue-600' : 'bg-slate-200',
            ].join(' ')}
            aria-label={s.facet}
          />
        ))}
      </div>

      {saveSuccess && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">✓ Configuration saved successfully!</AlertDescription>
        </Alert>
      )}
      {saveError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
      {importCount !== null && (
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800">✓ Imported {importCount} fields from markdown — review and save to apply.</AlertDescription>
        </Alert>
      )}
      {importError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{importError}</AlertDescription>
        </Alert>
      )}

      <Card className="p-8 mb-6">
        {/* Facet header */}
        <div className="flex items-start gap-4 mb-8 pb-6 border-b border-slate-100">
          <span className="text-3xl leading-none mt-0.5">{step.icon}</span>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
              Facet {step.id} of 6
            </p>
            <h2 className="text-2xl font-bold text-slate-900">{step.facet}</h2>
            <p className="text-sm text-slate-500 mt-1">{step.subtitle}</p>
          </div>
        </div>

        {/* ── Physique ── */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Field
              label="Visual Identity"
              hint="Describe the brand's look — colours, shapes, design language, signature product."
            >
              <Textarea
                rows={3}
                placeholder="e.g. Bold red and white palette, minimalist product design, iconic swoosh mark…"
                value={formData.physique ?? ''}
                onChange={e => set('physique', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Tagline / Slogan"
              hint="The line that best captures the brand in a single phrase."
            >
              <Textarea
                rows={2}
                placeholder="e.g. Just Do It"
                value={formData.tagline ?? ''}
                onChange={e => set('tagline', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Signature Products or Services"
              hint="The offerings most associated with the brand."
            >
              <Textarea
                rows={2}
                placeholder="e.g. Running shoes, athletic apparel, sports accessories"
                value={formData.signature_products ?? ''}
                onChange={e => set('signature_products', e.target.value)}
                className="mt-1"
              />
            </Field>
          </div>
        )}

        {/* ── Personality ── */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Field
              label="Character Traits"
              hint="Comma-separated traits — as if the brand were a person."
            >
              <Textarea
                rows={2}
                placeholder="e.g. bold, inspiring, competitive, authentic"
                value={formData.personality_traits ?? ''}
                onChange={e => set('personality_traits', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Tone of Voice"
              hint="How the brand speaks — choose a few adjectives."
            >
              <Textarea
                rows={2}
                placeholder="e.g. energetic, direct, motivational"
                value={formData.tone ?? ''}
                onChange={e => set('tone', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Response Style"
              hint="How the AI should structure its replies."
            >
              <Textarea
                rows={2}
                placeholder="e.g. short and punchy, never verbose, use action verbs"
                value={formData.response_style ?? ''}
                onChange={e => set('response_style', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Brand Promise / Soul"
              hint="One sentence capturing the brand's core commitment."
            >
              <Textarea
                rows={2}
                placeholder="e.g. To bring inspiration and innovation to every athlete in the world."
                value={formData.promise ?? ''}
                onChange={e => set('promise', e.target.value)}
                className="mt-1"
              />
            </Field>
          </div>
        )}

        {/* ── Culture ── */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Field
              label="Core Values"
              hint="Comma-separated values that the brand will never compromise."
            >
              <Textarea
                rows={2}
                placeholder="e.g. excellence, innovation, sustainability, community"
                value={formData.key_values ?? ''}
                onChange={e => set('key_values', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Beliefs & Principles"
              hint="What the brand stands for beyond its products."
            >
              <Textarea
                rows={3}
                placeholder="e.g. We believe sport is a universal language. Every athlete — regardless of ability — deserves the tools to reach their potential."
                value={formData.culture_beliefs ?? ''}
                onChange={e => set('culture_beliefs', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Origin & Mission"
              hint="Where the brand came from and why it exists."
            >
              <Textarea
                rows={3}
                placeholder="e.g. Founded in 1964 with a handshake and a shared love of running…"
                value={formData.culture_origin ?? ''}
                onChange={e => set('culture_origin', e.target.value)}
                className="mt-1"
              />
            </Field>
          </div>
        )}

        {/* ── Relationship ── */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <Field
              label="Relationship Type"
              hint="How would you describe the bond between brand and customer?"
            >
              <Textarea
                rows={2}
                placeholder="e.g. coach, mentor, training partner, challenger"
                value={formData.relationship_type ?? ''}
                onChange={e => set('relationship_type', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Escalation Triggers"
              hint="Topics where the AI should hand off to a human specialist. Comma-separated."
            >
              <Textarea
                rows={2}
                placeholder="e.g. refund disputes, injury complaints, legal questions"
                value={formData.escalation_triggers ?? ''}
                onChange={e => set('escalation_triggers', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Prohibited Topics"
              hint="Topics the AI must never engage with. Comma-separated."
            >
              <Textarea
                rows={2}
                placeholder="e.g. competitor comparisons, political opinions, pricing negotiation"
                value={formData.prohibited_topics ?? ''}
                onChange={e => set('prohibited_topics', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Webhook URL"
              hint="HTTPS endpoint to call when escalation is triggered."
            >
              <Textarea
                rows={1}
                placeholder="e.g. https://your-system.example.com/handoff"
                value={formData.webhook_url ?? ''}
                onChange={e => set('webhook_url', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Webhook Secret"
              hint="Used to sign the payload — verify with X-BRR-Signature header."
            >
              <input
                type="password"
                placeholder="e.g. whsec_..."
                value={formData.webhook_secret ?? ''}
                onChange={e => set('webhook_secret', e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </Field>
          </div>
        )}

        {/* ── Reflection ── */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <Field
              label="Target Audience"
              hint="Who the brand is primarily speaking to."
            >
              <Textarea
                rows={2}
                placeholder="e.g. athletes of all levels aged 16–40, performance-driven individuals"
                value={formData.target_audience ?? ''}
                onChange={e => set('target_audience', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Customer Archetype"
              hint="The idealised image of the person who uses this brand."
            >
              <Textarea
                rows={2}
                placeholder="e.g. the relentless competitor who refuses to settle"
                value={formData.reflection_archetype ?? ''}
                onChange={e => set('reflection_archetype', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Customer Values & Aspirations"
              hint="What this audience cares about and wants to achieve."
            >
              <Textarea
                rows={3}
                placeholder="e.g. They value performance, authenticity, and self-improvement. They aspire to personal bests — not just trophies."
                value={formData.customer_values ?? ''}
                onChange={e => set('customer_values', e.target.value)}
                className="mt-1"
              />
            </Field>
          </div>
        )}

        {/* ── Self-image ── */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <Field
              label="How Customers Feel"
              hint="Complete the sentence: 'When I use this brand, I feel…'"
            >
              <Textarea
                rows={3}
                placeholder="e.g. …capable, unstoppable, part of something bigger than myself."
                value={formData.selfimage_feeling ?? ''}
                onChange={e => set('selfimage_feeling', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="Aspiration Fulfilled"
              hint="What version of themselves does the brand help customers become?"
            >
              <Textarea
                rows={2}
                placeholder="e.g. the best version of an athlete"
                value={formData.selfimage_aspiration ?? ''}
                onChange={e => set('selfimage_aspiration', e.target.value)}
                className="mt-1"
              />
            </Field>
            <Field
              label="AI Response Guidelines"
              hint="Final rules the agent must always follow when responding."
            >
              <Textarea
                rows={3}
                placeholder="e.g. Never apologise for the brand's premium pricing. Always end with an encouraging call to action."
                value={formData.response_guidelines ?? ''}
                onChange={e => set('response_guidelines', e.target.value)}
                className="mt-1"
              />
            </Field>
          </div>
        )}

        <div className="flex gap-3 mt-10">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
            disabled={currentStep === 1}
          >
            ← Previous
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !isDirty} className="flex-1">
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => Math.min(STEPS.length, s + 1))}
            disabled={currentStep === STEPS.length}
          >
            Next →
          </Button>
        </div>
      </Card>

      {/* Step navigator */}
      <Card className="p-5 bg-slate-50">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Brand Prism</h3>
        <div className="space-y-1">
          {STEPS.map(s => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              className={[
                'w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2',
                currentStep === s.id
                  ? 'bg-blue-100 text-blue-900 font-medium'
                  : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              <span className="text-base leading-none">{s.icon}</span>
              <span>{s.facet}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
