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
        <Sidebar />
      </div>

      {/* Mobile Drawer (visible on < md when mobileNavOpen is true) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Sliding drawer content */}
          <div className="relative flex w-64 max-w-[80vw] flex-1 flex-col bg-card shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <Sidebar onClose={() => setMobileNavOpen(false)} />
          </div>
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
