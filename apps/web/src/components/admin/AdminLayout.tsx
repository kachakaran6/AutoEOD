// apps/web/src/components/admin/AdminLayout.tsx
import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { admin, ObservabilityOverview } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Activity,
  ScrollText,
  GitBranch,
  AlertOctagon,
  BarChart3,
  Users,
  ShieldCheck,
  ShieldAlert,
  Server,
  CalendarClock,
  Puzzle,
  Mail,
  Cpu,
  HeartPulse,
  Database,
  Layers,
  Settings2,
  Sliders,
  FileCode,
  DownloadCloud,
  FileArchive,
  BellRing,
  Search,
  ArrowLeft,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

interface NavGroup {
  label: string;
  items: Array<{
    name: string;
    path: string;
    icon: React.ElementType;
    badge?: string;
  }>;
}

const navGroups: NavGroup[] = [
  {
    label: 'Observability',
    items: [
      { name: 'Overview', path: '/admin/observability', icon: Activity },
      { name: 'Logs Explorer', path: '/admin/logs', icon: ScrollText },
      { name: 'Distributed Traces', path: '/admin/traces', icon: GitBranch },
      { name: 'Error Tracker', path: '/admin/errors', icon: AlertOctagon },
      { name: 'Performance Metrics', path: '/admin/metrics', icon: BarChart3 },
    ],
  },
  {
    label: 'Audit & Security',
    items: [
      { name: 'User Audit Trail', path: '/admin/audit/users', icon: Users },
      { name: 'Admin Audit Trail', path: '/admin/audit/admin', icon: ShieldCheck },
      { name: 'Security Incidents', path: '/admin/security', icon: ShieldAlert },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Background Jobs', path: '/admin/jobs', icon: Server },
      { name: 'Scheduler & Cron', path: '/admin/scheduler', icon: CalendarClock },
      { name: 'Integrations', path: '/admin/integrations', icon: Puzzle },
      { name: 'Email Deliveries', path: '/admin/email', icon: Mail },
    ],
  },
  {
    label: 'AI Subsystem',
    items: [{ name: 'AI & Models', path: '/admin/ai', icon: Cpu }],
  },
  {
    label: 'Infrastructure Health',
    items: [
      { name: 'System Health', path: '/admin/system-health', icon: HeartPulse },
      { name: 'Database Status', path: '/admin/system-health/database', icon: Database },
      { name: 'Redis / Cache', path: '/admin/system-health/redis', icon: Layers },
    ],
  },
  {
    label: 'Analytics',
    items: [{ name: 'Analytics & Trends', path: '/admin/analytics', icon: BarChart3 }],
  },
  {
    label: 'Governance & Settings',
    items: [
      { name: 'Remote Config', path: '/admin/config', icon: Sliders },
      { name: 'Users & Roles', path: '/admin/users', icon: Users },
      { name: 'Email Templates', path: '/admin/templates', icon: FileCode },
      { name: 'Extension Releases', path: '/admin/extension', icon: DownloadCloud },
      { name: 'Log Settings', path: '/admin/log-settings', icon: Settings2 },
      { name: 'Data Retention', path: '/admin/retention', icon: FileArchive },
      { name: 'Alert Rules', path: '/admin/alerts', icon: BellRing },
    ],
  },
];

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'degraded' | 'down'>('healthy');

  useEffect(() => {
    // Initial health check ping
    admin.getObservabilityOverview()
      .then((data) => {
        if (data.systemHealth?.overall) {
          setHealthStatus(data.systemHealth.overall);
        }
      })
      .catch(() => setHealthStatus('degraded'));

    // Periodic health pulse
    const interval = setInterval(() => {
      admin.getObservabilityOverview()
        .then((data) => {
          if (data.systemHealth?.overall) {
            setHealthStatus(data.systemHealth.overall);
          }
        })
        .catch(() => setHealthStatus('degraded'));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    if (query.startsWith('tr_') || query.length > 20) {
      navigate(`/admin/traces/${query}`);
    } else {
      navigate(`/admin/logs?search=${encodeURIComponent(query)}`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Admin Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border/80 flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md font-bold">
              AE
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                AutoEOD <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">ADMIN</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Observability & Control</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.path === '/admin/observability'
                    ? location.pathname === '/admin' || location.pathname === '/admin/observability'
                    : location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          'h-4 w-4 transition-colors',
                          isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                        )}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {item.badge}
                      </Badge>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border bg-muted/20 space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs h-9"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Application
          </Button>

          <div className="flex items-center justify-between px-1 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  healthStatus === 'healthy' && 'bg-emerald-500 animate-pulse',
                  healthStatus === 'degraded' && 'bg-amber-500',
                  healthStatus === 'down' && 'bg-rose-500'
                )}
              />
              <span className="capitalize text-muted-foreground font-mono text-[11px]">{healthStatus}</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">v1.2.0</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border/80 bg-card/60 backdrop-blur-md px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Admin</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-semibold text-foreground capitalize">
                {location.pathname.replace('/admin/', '').replace(/-/g, ' ') || 'Observability'}
              </span>
            </div>
          </div>

          {/* Search bar & Live health */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search trace ID, request ID, logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-muted/40 font-mono"
              />
            </form>

            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  'gap-1.5 text-[11px] font-mono font-medium',
                  healthStatus === 'healthy'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                Live Telemetry
              </Badge>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
