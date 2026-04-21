import { Link, useRouterState } from '@tanstack/react-router'
import {
  Languages,
  GitPullRequest,
  BarChart2,
  ArrowDownUp,
  Users,
  LogOut,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/app/providers/AuthProvider'
import { ROUTES } from '@/shared/config/routes'

const navItems = [
  { label: 'Keys',            path: ROUTES.KEYS,           icon: Languages },
  { label: 'Change Requests', path: ROUTES.CHANGE_REQUESTS, icon: GitPullRequest },
  { label: 'Coverage',        path: ROUTES.COVERAGE,        icon: BarChart2 },
  { label: 'Import / Export', path: ROUTES.IMPORT_EXPORT,   icon: ArrowDownUp },
  { label: 'Users',           path: ROUTES.USERS,           icon: Users },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const { location }      = useRouterState()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">Hato TMS</span>
        <span className="ml-2 text-xs text-muted-foreground">v2</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = location.pathname.startsWith(path)
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className="mb-2 px-1">
          <p className="truncate text-xs font-medium text-foreground">{user?.displayName ?? user?.email}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
