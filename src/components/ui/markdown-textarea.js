'use client'

import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownView } from '@/components/ui/markdown-view'
import { formatValue } from '@/lib/brand-config'

export function MarkdownTextarea({ value, onChange, placeholder, rows = 3, className = '', minHeight }) {
  const [mode, setMode] = useState('edit')
  const stringValue = formatValue(value)
  const hasContent = stringValue.trim().length > 0

  // Match the textarea's vertical footprint when previewing so the layout doesn't jump
  const previewMinHeight = minHeight ?? `${Math.max(rows, 3) * 1.5 + 1.5}rem`

  return (
    <div className={`border border-slate-200 rounded-md overflow-hidden bg-white ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={[
              'text-xs px-2 py-1 rounded transition-colors',
              mode === 'edit'
                ? 'bg-white border border-slate-200 text-slate-900 font-medium'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            disabled={!hasContent}
            className={[
              'text-xs px-2 py-1 rounded transition-colors',
              mode === 'preview'
                ? 'bg-white border border-slate-200 text-slate-900 font-medium'
                : 'text-slate-500 hover:text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            Preview
          </button>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">markdown</span>
      </div>

      {mode === 'edit' ? (
        <Textarea
          value={stringValue}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-y"
        />
      ) : (
        <div className="p-3 overflow-auto" style={{ minHeight: previewMinHeight }}>
          {hasContent
            ? <MarkdownView>{stringValue}</MarkdownView>
            : <p className="text-xs text-slate-400 italic">Nothing to preview</p>
          }
        </div>
      )}
    </div>
  )
}
