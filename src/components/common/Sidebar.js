'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/brands', label: 'Brands', icon: '🏷️' },
  { href: '/dashboard/agents', label: 'Agents', icon: '🤖' },
  { href: '/dashboard/organizations', label: 'Organizations', icon: '🏢' },
  { href: '/dashboard/billing', label: 'Billing', icon: '💳' },
  { href: '/dashboard/admin', label: 'Admin', icon: '🛡️' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  { href: '/dashboard/guide', label: 'Guide', icon: '📖' },
]

export function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-200 shrink-0">
        <h2 className="text-lg font-bold text-slate-900">BRR AI</h2>
        <p className="text-xs text-slate-500 mt-1">Training System</p>
      </div>

      <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

    </aside>
  )
}
