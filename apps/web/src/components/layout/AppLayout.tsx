import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const { pathname } = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Auto-close mobile navigation on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar (visible on md+) */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar className="w-64" />
      </div>

      {/* Mobile Fullscreen Navigation (visible on < md when mobileNavOpen is true) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-background animate-in fade-in duration-150">
          <Sidebar onClose={() => setMobileNavOpen(false)} className="w-full border-r-0" />
        </div>
      )}

      {/* Main content container */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <TopBar
          pathname={pathname}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-3.5 sm:px-6 sm:py-6 animate-fade-in max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
