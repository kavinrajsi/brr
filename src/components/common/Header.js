'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Admin link is gated by NEXT_PUBLIC_ADMIN_USER_IDS (mirror of the server-side
// ADMIN_USER_IDS env). Non-admins shouldn't see it — the API enforces the
// real check; this is just UX so users don't click into a 403.
const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const baseNavItems = [
  { href: '/dashboard',               label: 'Dashboard'     },
  { href: '/dashboard/brands',        label: 'Brands'        },
  { href: '/dashboard/agents',        label: 'Agents'        },
  { href: '/dashboard/organizations', label: 'Organizations' },
  { href: '/dashboard/billing',       label: 'Billing'       },
  { href: '/dashboard/settings',      label: 'Settings'      },
  { href: '/dashboard/guide',         label: 'Guide'         },
]
const adminNavItem = { href: '/dashboard/admin', label: 'Admin' }

function isActiveLink(pathname, href) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
}

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAdmin = user?.id && ADMIN_IDS.includes(user.id)
  const navItems = isAdmin ? [...baseNavItems.slice(0, 5), adminNavItem, ...baseNavItems.slice(5)] : baseNavItems

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-6 gap-4">
        {/* Left: brand */}
        <Link href="/dashboard" className="text-xl font-bold text-slate-900 shrink-0">
          BRR AI
        </Link>

        {/* Center: desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navItems.map(item => {
            const active = isActiveLink(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Right: account + mobile toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 transition-colors outline-none">
                Account
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-semibold text-slate-500">ACCOUNT</p>
                  <p className="text-sm text-slate-900 font-medium mt-1 truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  variant="destructive"
                  className="cursor-pointer"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle navigation"
          >
            <svg className="w-5 h-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-200 px-4 py-3 space-y-1 bg-white">
          {navItems.map(item => {
            const active = isActiveLink(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
