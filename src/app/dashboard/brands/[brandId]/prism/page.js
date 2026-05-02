'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useBrandConfig } from '@/hooks/useBrandConfig'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const FACETS = [
  {
    id: 1,
    facet: 'Physique',
    icon: '◻',
    subtitle: 'Tangible characteristics — what the brand looks and feels like.',
    fields: [
      { key: 'physique', label: 'Visual Identity' },
      { key: 'tagline', label: 'Tagline / Slogan' },
      { key: 'signature_products', label: 'Signature Products or Services' },
    ],
  },
  {
    id: 2,
    facet: 'Personality',
    icon: '◇',
    subtitle: 'Character traits, as if the brand were a person.',
    fields: [
      { key: 'personality_traits', label: 'Character Traits' },
      { key: 'tone', label: 'Tone of Voice' },
      { key: 'response_style', label: 'Response Style' },
      { key: 'promise', label: 'Brand Promise / Soul' },
    ],
  },
  {
    id: 3,
    facet: 'Culture',
    icon: '△',
    subtitle: 'Values, beliefs, and origin that drive the brand.',
    fields: [
      { key: 'key_values', label: 'Core Values' },
      { key: 'culture_beliefs', label: 'Beliefs & Principles' },
      { key: 'culture_origin', label: 'Origin & Mission' },
    ],
  },
  {
    id: 4,
    facet: 'Relationship',
    icon: '○',
    subtitle: 'How the brand interacts with and treats its customers.',
    fields: [
      { key: 'relationship_type', label: 'Relationship Type' },
      { key: 'escalation_triggers', label: 'Escalation Triggers' },
      { key: 'prohibited_topics', label: 'Prohibited Topics' },
    ],
  },
  {
    id: 5,
    facet: 'Reflection',
    icon: '▽',
    subtitle: 'The idealised image of the customer the brand projects.',
    fields: [
      { key: 'target_audience', label: 'Target Audience' },
      { key: 'reflection_archetype', label: 'Customer Archetype' },
      { key: 'customer_values', label: 'Customer Values & Aspirations' },
    ],
  },
  {
    id: 6,
    facet: 'Self-image',
    icon: '◁',
    subtitle: 'What customers feel about themselves when using the brand.',
    fields: [
      { key: 'selfimage_feeling', label: 'How Customers Feel' },
      { key: 'selfimage_aspiration', label: 'Aspiration Fulfilled' },
      { key: 'response_guidelines', label: 'AI Response Guidelines' },
    ],
  },
]

function buildMarkdown(config) {
  const lines = ['# Brand Prism\n']
  for (const facet of FACETS) {
    lines.push(`## ${facet.id}. ${facet.facet}`)
    lines.push(`_${facet.subtitle}_\n`)
    for (const { key, label } of facet.fields) {
      const val = config[key]
      if (val) lines.push(`**${label}:** ${val}\n`)
    }
  }
  return lines.join('\n')
}

export default function BrandPrismPage() {
  const { brandId } = useParams()
  const { config, isLoading, error } = useBrandConfig(brandId)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(buildMarkdown(config ?? {}))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const md = buildMarkdown(config ?? {})
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'brand-prism.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return <Card className="p-12 text-center"><p className="text-slate-600">Loading Brand Prism…</p></Card>
  }

  if (error) {
    return (
      <Card className="p-12 text-center bg-red-50 border-red-200">
        <p className="text-red-800 mb-4">{error}</p>
        <Link href={`/dashboard/brands/${brandId}`}><Button variant="outline">Back to Brand</Button></Link>
      </Card>
    )
  }

  const hasAnyData = FACETS.some(f => f.fields.some(({ key }) => config?.[key]))

  return (
    <div>
      <div className="mb-8">
        <Link href={`/dashboard/brands/${brandId}`} className="text-slate-600 hover:text-slate-900 mb-4 inline-block">
          ← Back to Brand
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Brand Prism</h1>
            <p className="text-slate-600 mt-1">Kapferer's six-facet brand identity model</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={!hasAnyData}>
              Download .md
            </Button>
            <Button onClick={handleCopy} disabled={!hasAnyData}>
              {copied ? '✓ Copied!' : 'Copy as Markdown'}
            </Button>
          </div>
        </div>
      </div>

      {!hasAnyData && (
        <Card className="p-8 text-center bg-slate-50 mb-6">
          <p className="text-slate-500 mb-4">No brand configuration yet.</p>
          <Link href={`/dashboard/brands/${brandId}/config`}>
            <Button>Configure Brand Prism</Button>
          </Link>
        </Card>
      )}

      <div className="space-y-4">
        {FACETS.map(facet => {
          const filledFields = facet.fields.filter(({ key }) => config?.[key])
          if (!filledFields.length) return null
          return (
            <Card key={facet.id} className="p-6">
              <div className="flex items-start gap-3 mb-5 pb-4 border-b border-slate-100">
                <span className="text-2xl leading-none mt-0.5">{facet.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
                    Facet {facet.id} of 6
                  </p>
                  <h2 className="text-lg font-bold text-slate-900">{facet.facet}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{facet.subtitle}</p>
                </div>
              </div>
              <dl className="space-y-4">
                {filledFields.map(({ key, label }) => (
                  <div key={key}>
                    <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</dt>
                    <dd className="text-sm text-slate-800 whitespace-pre-wrap">{config[key]}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )
        })}
      </div>

      {hasAnyData && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={handleDownload}>Download .md</Button>
          <Button onClick={handleCopy}>{copied ? '✓ Copied!' : 'Copy as Markdown'}</Button>
        </div>
      )}
    </div>
  )
}
