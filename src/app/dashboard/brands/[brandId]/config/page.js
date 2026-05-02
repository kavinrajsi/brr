'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useBrandConfig } from '@/hooks/useBrandConfig'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Link from 'next/link'

const STEPS = [
  { id: 1, title: 'Brand Philosophy' },
  { id: 2, title: 'Non-Negotiables' },
  { id: 3, title: 'Vocabulary' },
  { id: 4, title: 'Design Rules' },
  { id: 5, title: 'Client Preferences' },
  { id: 6, title: 'Core Test' },
]

export default function BrandConfigPage() {
  const { brandId } = useParams()
  const { config, isLoading, error, isSaving, saveConfig } = useBrandConfig(brandId)
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (config) setFormData(config)
  }, [config])

  const handleSave = async () => {
    setSaveError('')
    setSaveSuccess(false)
    try {
      await saveConfig(formData)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err.message)
    }
  }

  const setField = (key, value) => setFormData(prev => ({ ...prev, [key]: value }))

  if (isLoading) {
    return (
      <Card className="p-12 text-center">
        <p className="text-slate-600">Loading configuration…</p>
      </Card>
    )
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
        <h1 className="text-3xl font-bold text-slate-900">Configure Brand</h1>
        <p className="text-slate-600 mt-1">Step {currentStep} of {STEPS.length}</p>
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
            aria-label={s.title}
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

      <Card className="p-8 mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">{step.title}</h2>

        {currentStep === 1 && (
          <div className="space-y-5">
            <div>
              <Label htmlFor="soul">Brand Soul</Label>
              <Input
                id="soul"
                placeholder="One sentence capturing the brand essence"
                value={formData.soul ?? ''}
                onChange={e => setField('soul', e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="promise">Core Promise</Label>
              <Input
                id="promise"
                placeholder="What the brand promises to its audience"
                value={formData.promise ?? ''}
                onChange={e => setField('promise', e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="tone">Tone of Voice</Label>
              <Input
                id="tone"
                placeholder="e.g., warm, playful, professional"
                value={formData.tone ?? ''}
                onChange={e => setField('tone', e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
        )}

        {currentStep !== 1 && (
          <div className="p-8 bg-slate-50 rounded-lg text-center">
            <p className="text-slate-600">Step {currentStep}: {step.title}</p>
            <p className="text-sm text-slate-400 mt-1">Form fields — customize for your BRR structure</p>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(s => Math.max(1, s - 1))}
            disabled={currentStep === 1}
          >
            ← Previous
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1"
          >
            {isSaving ? 'Saving…' : 'Save Progress'}
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
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">All Steps</h3>
        <div className="space-y-1">
          {STEPS.map(s => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              className={[
                'w-full text-left px-3 py-2 rounded text-sm transition-colors',
                currentStep === s.id
                  ? 'bg-blue-100 text-blue-900 font-medium'
                  : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {s.id}. {s.title}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
