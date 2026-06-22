// apps/web/src/components/layout/AppLayout.tsx
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/timeline': 'Activity Timeline',
  '/integrations': 'Integrations',
  '/settings': 'Settings',
}

function getTitle(pathname: string): string {
  if (pathname.startsWith('/reports/')) return 'EOD Report'
  return pageTitles[pathname] || 'AutoEOD'
}

export function AppLayout() {
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title={getTitle(pathname)} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-6 py-8 animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
