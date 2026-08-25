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
  Bot,
  X,
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
  { tab: 'models', label: 'AI & Models', icon: Bot },
  { tab: 'users', label: 'Users & Roles', icon: Users },
  { tab: 'health', label: 'System & Queues', icon: Server },
  { tab: 'analytics', label: 'API & Analytics', icon: BarChart3 },
  { tab: 'templates', label: 'Email Templates', icon: Mail },
  { tab: 'audit', label: 'Audit Logs', icon: ScrollText },
]

interface SidebarProps {
  onClose?: () => void
  className?: string
}

export function Sidebar({ onClose, className }: SidebarProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const currentTab = searchParams.get('tab') || 'config'

  const handleNavClick = () => {
    if (onClose) {
      onClose()
    }
  }

  return (
    <aside
      className={cn(
        'flex h-full w-64 flex-col border-r border-border bg-card/95 backdrop-blur-md overflow-y-auto z-40',
        className
      )}
    >
      {/* Logo & Mobile Close */}
      <div className="flex h-14 items-center justify-between px-4 sm:px-5 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 shadow-sm shadow-primary/10">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-foreground">AutoEOD</span>
            <p className="text-[10px] text-muted-foreground font-medium leading-none mt-0.5">AI Report Engine</p>
          </div>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="md:hidden h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-4 px-3 py-4">
        <div className="space-y-1">
          {baseNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={handleNavClick}
              id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary border border-primary/20 font-semibold shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
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
                  onClick={handleNavClick}
                  id={`nav-admin-${tab}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150',
                    isAdminActive
                      ? 'bg-primary/10 text-primary border border-primary/20 font-semibold shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
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
      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 bg-muted/30 border border-border/60">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary font-bold text-xs shrink-0 ring-1 ring-primary/30">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate font-mono">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
          onClick={() => {
            handleNavClick()
            logout()
          }}
          id="btn-logout"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
