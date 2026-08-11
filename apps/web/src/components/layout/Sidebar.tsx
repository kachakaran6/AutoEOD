import { NavLink, useSearchParams, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  Puzzle,
  Settings,
  Zap,
  LogOut,
  Activity,
  FileText,
  Shield,
  Sliders,
  Users,
  Server,
  BarChart3,
  Mail,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

const baseNavItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/activity-log', label: 'Activity Radar', icon: Activity },
  { to: '/history', label: 'History', icon: FileText },
  { to: '/timeline', label: 'Timeline', icon: GitBranch },
  { to: '/integrations', label: 'Integrations', icon: Puzzle },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const adminNavItems = [
  { tab: 'config', label: 'Remote Config', icon: Sliders },
  { tab: 'users', label: 'Users & Roles', icon: Users },
  { tab: 'health', label: 'System & Queues', icon: Server },
  { tab: 'analytics', label: 'API & Analytics', icon: BarChart3 },
  { tab: 'templates', label: 'Email Templates', icon: Mail },
  { tab: 'audit', label: 'Audit Logs', icon: ScrollText },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'config'

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card/50 backdrop-blur-sm overflow-y-auto">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5 border-b border-border shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-border">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <span className="font-semibold text-sm">AutoEOD</span>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">AI Report Generator</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-4 px-3 py-4">
        <div className="space-y-1">
          {baseNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/20 font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Admin Navigation Section */}
        {user?.role === 'ADMIN' && (
          <div className="pt-3 border-t border-border/60 space-y-1">
            <div className="px-3 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
              <Shield className="h-3 h-3 text-primary" />
              ADMINISTRATION
            </div>

            {adminNavItems.map(({ tab, label, icon: Icon }) => {
              const isAdminActive = pathname === '/admin' && currentTab === tab
              return (
                <NavLink
                  key={tab}
                  to={`/admin?tab=${tab}`}
                  id={`nav-admin-${tab}`}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200',
                    isAdminActive
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/20 font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              )
            })}
          </div>
        )}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm shrink-0">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={logout}
          id="btn-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
