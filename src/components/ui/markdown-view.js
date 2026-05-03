'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ inline, children }) =>
    inline
      ? <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-[0.85em] font-mono">{children}</code>
      : <code className="block bg-slate-900 text-green-300 p-2 rounded text-[0.85em] font-mono overflow-x-auto whitespace-pre">{children}</code>,
  pre: ({ children }) => <pre className="my-2">{children}</pre>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  h1: ({ children }) => <h1 className="text-base font-bold mt-2 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{children}</a>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-slate-300 pl-2 italic text-slate-600 my-1">{children}</blockquote>,
  hr: () => <hr className="my-2 border-slate-200" />,
  table: ({ children }) => <table className="border-collapse border border-slate-200 my-2 text-xs">{children}</table>,
  th: ({ children }) => <th className="border border-slate-200 px-2 py-1 bg-slate-50 font-semibold text-left">{children}</th>,
  td: ({ children }) => <td className="border border-slate-200 px-2 py-1">{children}</td>,
}

export function MarkdownView({ children, className = '' }) {
  return (
    <div className={`text-sm text-slate-800 ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
