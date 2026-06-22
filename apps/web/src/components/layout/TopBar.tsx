// apps/web/src/components/layout/TopBar.tsx
import { Bell } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { notifications as notificationsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

interface TopBarProps {
  title: string
}

export function TopBar({ title }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false)
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

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={handleBellClick}
          id="btn-notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
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
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{unreadCount} new</Badge>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No notifications yet
                  </div>
                ) : (
                  notifs.map((notif) => (
                    <button
                      key={notif.id}
                      className={cn(
                        'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-accent border-b border-border/50 last:border-0',
                        !notif.read && 'bg-primary/5'
                      )}
                      onClick={() => {
                        if (notif.reportId) {
                          // Navigate to the report
                          setShowNotifications(false)
                          navigate(`/reports/today`)
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex h-2 w-2 rounded-full shrink-0',
                            notif.type === 'report_ready' ? 'bg-emerald-400' : 'bg-red-400',
                            notif.read && 'opacity-0'
                          )}
                        />
                        <span className="text-sm font-medium">{notif.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-4">{notif.message}</p>
                      <p className="text-[11px] text-muted-foreground/60 pl-4">
                        {format(new Date(notif.createdAt), 'MMM d, h:mm a')}
                      </p>
                    </button>
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
