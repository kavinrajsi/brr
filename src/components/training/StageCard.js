'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

const STAGE_NAMES = [
  'Onboarding',
  'Supervised Training',
  'Probation',
  'Certification',
  'Deployment',
  'Ongoing Learning',
]

const STATUS_CONFIG = {
  Pending:     { bg: 'bg-slate-50 border-slate-200',  badge: 'bg-slate-100 text-slate-600',   label: 'Pending'     },
  'In Progress': { bg: 'bg-blue-50 border-blue-200',  badge: 'bg-blue-100 text-blue-700',     label: 'In Progress' },
  Complete:    { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700',   label: 'Complete'    },
  Failed:      { bg: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-700',       label: 'Failed'      },
}

export function StageCard({ stage, href, evaluateButton }) {
  if (!stage) return null

  const cfg = STATUS_CONFIG[stage.status] ?? STATUS_CONFIG.Pending
  const isPending = stage.status === 'Pending'

  const buttonLabel =
    stage.status === 'In Progress' ? 'Continue' :
    stage.status === 'Complete'    ? 'Review'   :
    stage.status === 'Failed'      ? 'Retry'    : 'Locked'

  return (
    <div className={`border rounded-xl px-5 py-4 flex items-center gap-4 ${cfg.bg}`}>
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider w-14 shrink-0">
        Stage {stage.stage}
      </span>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-slate-900">
          {STAGE_NAMES[stage.stage - 1]}
        </h3>
        {stage.completed_at && (
          <p className="text-xs text-slate-400 mt-0.5">
            Completed {new Date(stage.completed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.badge}`}>
        {cfg.label}
      </span>

      {evaluateButton}

      {href && !isPending ? (
        <Link href={href} className="shrink-0">
          <Button size="sm" variant={stage.status === 'In Progress' ? 'default' : 'outline'}>
            {buttonLabel}
          </Button>
        </Link>
      ) : (
        <Button size="sm" variant="outline" disabled className="shrink-0">
          {buttonLabel}
        </Button>
      )}
    </div>
  )
}
