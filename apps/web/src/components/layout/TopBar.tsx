import { Bell, Moon, Sun } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { notifications as notificationsApi } from '@/lib/api'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useNavigate, Link } from 'react-router-dom'
import { format } from 'date-fns'

interface TopBarProps {
  pathname: string
}

export function TopBar({ pathname }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const { theme, setTheme } = useTheme()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: notifs = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000, // poll every 30s
  })

  const unreadCount = notifs.filter((n) => !n.read).length

  const markReadMutation = useMutation({
    mutationFn: () => notificationsApi.markRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const handleBellClick = () => {
    setShowNotifications((v) => !v)
    if (!showNotifications && unreadCount > 0) {
      markReadMutation.mutate()
    }
  }

  const generateBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean)
    if (paths.length === 0) {
      return (
        <nav className="flex items-center text-sm font-medium text-muted-foreground">
          <span className="text-foreground font-semibold">Dashboard</span>
        </nav>
      )
    }

    return (
      <nav className="flex items-center text-sm font-medium text-muted-foreground space-x-2">
        <Link to="/" className="hover:text-foreground transition-colors">Dashboard</Link>
        {paths.map((path, index) => {
          const isLast = index === paths.length - 1
          const href = '/' + paths.slice(0, index + 1).join('/')
          const formattedPath = path.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
          
          return (
            <div key={path} className="flex items-center space-x-2">
              <span className="text-border">/</span>
              {isLast ? (
                <span className="text-foreground font-semibold">{formattedPath}</span>
              ) : (
                <Link to={href} className="hover:text-foreground transition-colors">
                  {formattedPath}
                </Link>
              )}
            </div>
          )
        })}
      </nav>
    )
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/75 backdrop-blur-md px-6 z-30 transition-colors">
      <div className="flex items-center">
        {generateBreadcrumbs()}
      </div>

      <div className="flex items-center gap-2 relative">
        {/* Simple & Clean Dark / Light Mode Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          className="relative rounded-lg hover:bg-muted"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all text-amber-500 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all text-indigo-400 dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-lg hover:bg-muted"
          onClick={handleBellClick}
          id="btn-notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* Notification dropdown */}
        {showNotifications && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowNotifications(false)}
            />
            <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-border bg-popover shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markReadMutation.mutate()}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {notifs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left',
                        !n.read && 'bg-primary/5'
                      )}
                      onClick={() => {
                        setShowNotifications(false)
                        if (n.reportId) {
                          navigate('/')
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">
                          {n.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(n.createdAt), 'MMM d, HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
