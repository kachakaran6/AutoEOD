import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, addSeconds } from 'date-fns'
import {
  Activity,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Search,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Globe,
  Filter,
  Check,
} from 'lucide-react'

import { activityLog } from '@/lib/api'
import type { BrowserActivityLog } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

export function ActivityLogPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const pageSize = 25
  
  const [domainFilter, setDomainFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: ['activityLog', page, pageSize, domainFilter, dateFilter],
    queryFn: () => activityLog.list({
      page,
      limit: pageSize,
      domain: domainFilter || undefined,
      date: dateFilter || undefined,
    }),
  })

  const toggleSelectionMutation = useMutation({
    mutationFn: ({ id, selected }: { id: string, selected: boolean }) =>
      activityLog.updateSelected(id, selected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    },
  })

  const bulkSelectMutation = useMutation({
    mutationFn: (selected: boolean) =>
      activityLog.bulkSelect(selected, domainFilter || undefined, dateFilter || undefined),
    onSuccess: (res) => {
      toast.success(`Updated ${res.updatedCount} logs`)
      queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    },
  })

  const promoteMutation = useMutation({
    mutationFn: () => activityLog.promote(dateFilter || undefined),
    onSuccess: (res) => {
      toast.success(`Promoted ${res.promotedCount} selected logs to Activity Events`)
      queryClient.invalidateQueries({ queryKey: ['activityLog'] })
    },
  })

  const logs = data?.data || []
  const totalLogs = data?.meta.total || 0
  const totalPages = Math.ceil(totalLogs / pageSize) || 1
  const selectedCount = logs.filter(l => l.selected && !l.promotedToEventId).length

  return (
    <div className="space-y-4">
      {/* ── Unified Filter & Actions Toolbar ───────────────────────── */}
      <Card className="border-border bg-card">
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              {/* Date Selector */}
              <Input 
                type="date" 
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setPage(1)
                }}
                className="w-full sm:w-40 text-xs h-9 pl-3 pr-2 rounded-xl bg-background"
              />

              {/* Domain / Text Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter domain or title..."
                  value={domainFilter}
                  onChange={(e) => {
                    setDomainFilter(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9 text-xs h-9 rounded-xl bg-background w-full"
                />
              </div>

              {/* Selection actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bulkSelectMutation.mutate(true)}
                  disabled={logs.length === 0}
                  className="h-8 text-xs px-2.5 rounded-lg"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => bulkSelectMutation.mutate(false)}
                  disabled={logs.length === 0}
                  className="h-8 text-xs px-2.5 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Promote Action & Count */}
            <div className="flex items-center justify-between lg:justify-end gap-2.5 border-t lg:border-t-0 pt-2 lg:pt-0 border-border">
              <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0.5">
                {totalLogs} {totalLogs === 1 ? 'log' : 'logs'}
              </Badge>

              <Button 
                onClick={() => promoteMutation.mutate()}
                disabled={promoteMutation.isPending || (selectedCount === 0 && totalLogs === 0)}
                className="gap-2 text-xs font-semibold h-9 rounded-xl shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Promote Selected
                {selectedCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground text-[10px] font-mono font-bold">
                    {selectedCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Activity Table / List Card ─────────────────────────────── */}
      <Card className="border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Activity className="h-6 w-6 text-primary animate-pulse" />
            Loading activity stream...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-muted-foreground">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">No activity logs recorded</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No activity detected for {dateFilter}. Make sure your AutoEOD browser extension is active and connected.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {/* Desktop Table Header (hidden on small screens) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1 flex items-center">
                <span>Select</span>
              </div>
              <div className="col-span-2">Time Window</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-3">Domain</div>
              <div className="col-span-4">Page Details & Title</div>
            </div>

            {/* List items (responsive for both desktop & mobile) */}
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const start = new Date(log.tabOpenedAt)
                const end = log.tabClosedAt ? new Date(log.tabClosedAt) : addSeconds(start, log.durationSeconds)
                const isSelected = log.selected
                const isPromoted = Boolean(log.promotedToEventId)

                return (
                  <div
                    key={log.id}
                    className={`p-3.5 sm:p-4 transition-colors hover:bg-muted/30 ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Desktop layout */}
                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 flex items-center">
                        {isPromoted ? (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            Promoted
                          </Badge>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              toggleSelectionMutation.mutate({
                                id: log.id,
                                selected: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                        )}
                      </div>

                      <div className="col-span-2 text-xs font-mono text-muted-foreground">
                        {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                      </div>

                      <div className="col-span-2">
                        <span className="text-xs font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/60">
                          {log.durationSeconds < 60
                            ? `${log.durationSeconds}s`
                            : `${Math.floor(log.durationSeconds / 60)}m ${log.durationSeconds % 60}s`}
                        </span>
                      </div>

                      <div className="col-span-3 flex items-center gap-1.5 min-w-0">
                        <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-semibold text-foreground truncate">
                          {log.domain}
                        </span>
                      </div>

                      <div className="col-span-4 min-w-0">
                        <p className="text-xs text-foreground font-medium truncate" title={log.pageTitle || log.url}>
                          {log.pageTitle || log.url}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                          {log.url}
                        </p>
                      </div>
                    </div>

                    {/* Mobile layout */}
                    <div className="md:hidden flex items-start gap-3">
                      <div className="pt-0.5">
                        {isPromoted ? (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            ✓
                          </Badge>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) =>
                              toggleSelectionMutation.mutate({
                                id: log.id,
                                selected: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                            <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                            {log.domain}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                            {log.durationSeconds < 60
                              ? `${log.durationSeconds}s`
                              : `${Math.floor(log.durationSeconds / 60)}m`}
                          </span>
                        </div>

                        <p className="text-xs text-foreground font-medium line-clamp-1">
                          {log.pageTitle || log.url}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>
                            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
                          </span>
                          {isPromoted && (
                            <span className="text-emerald-500 font-semibold">Promoted</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {totalLogs > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({totalLogs} items)
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
