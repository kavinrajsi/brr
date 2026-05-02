'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export function DashboardHeader() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-6">
        <h1 className="text-xl font-bold text-slate-900">BRR AI Training</h1>

        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 hidden sm:inline">
              {user.email}
            </span>

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
          </div>
        )}
      </div>
    </header>
  )
}
