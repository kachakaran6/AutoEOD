// apps/web/src/pages/TimelinePage.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  GitCommitHorizontal,
  GitPullRequest,
  GitMerge,
  MessageSquare,
  Bug,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react'
import { activity } from '@/lib/api'
import type { ActivityEvent } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function getEventIcon(type: string) {
  switch (type) {
    case 'commit': return <GitCommitHorizontal className="h-4 w-4 text-violet-400" />
    case 'pull_request': return <GitPullRequest className="h-4 w-4 text-indigo-400" />
    case 'pr_review': return <GitMerge className="h-4 w-4 text-blue-400" />
    case 'issue': return <Bug className="h-4 w-4 text-amber-400" />
    case 'issue_comment': return <MessageSquare className="h-4 w-4 text-emerald-400" />
    case 'chatgpt_conversation': return <MessageSquare className="h-4 w-4 text-green-400" />
    default: return <Activity className="h-4 w-4 text-muted-foreground" />
  }
}

function getEventTypeLabel(type: string) {
  switch (type) {
    case 'commit': return { label: 'Commit', variant: 'info' as const }
    case 'pull_request': return { label: 'Pull Request', variant: 'default' as const }
    case 'pr_review': return { label: 'PR Review', variant: 'secondary' as const }
    case 'issue': return { label: 'Issue', variant: 'warning' as const }
    case 'issue_comment': return { label: 'Comment', variant: 'secondary' as const }
    case 'chatgpt_conversation': return { label: 'ChatGPT', variant: 'secondary' as const }
    default: return { label: type, variant: 'outline' as const }
  }
}

export function TimelinePage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const { data, isLoading } = useQuery({
    queryKey: ['activity', date],
    queryFn: () => activity.getByDate(date),
  })

  const adjustDate = (days: number) => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setDate(format(d, 'yyyy-MM-dd'))
  }

  const isToday = date === format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Activity Timeline</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your GitHub activity tracked in real-time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => adjustDate(-1)}
            id="btn-prev-day"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm font-medium min-w-32 justify-center">
            {isToday ? 'Today' : format(new Date(date + 'T12:00:00'), 'MMM d, yyyy')}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => adjustDate(1)}
            disabled={isToday}
            id="btn-next-day"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {isLoading ? 'Loading...' : `${data?.events.length ?? 0} events`}
          </CardTitle>
          <CardDescription>
            {format(new Date(date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')} · {data?.timezone || 'UTC'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.events.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Activity className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">No activity recorded</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {isToday
                    ? 'Activity is synced every 15 minutes. Push some commits to see them appear here.'
                    : 'No GitHub activity was tracked on this date.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {data.events.map((event: ActivityEvent, i: number) => {
                  const { label, variant } = getEventTypeLabel(event.type)
                  return (
                    <div key={event.id} className="flex gap-4 relative animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                      {/* Icon */}
                      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shrink-0">
                        {getEventIcon(event.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="text-sm font-medium leading-tight flex-1 min-w-0">
                            {event.title}
                          </span>
                          <Badge variant={variant} className="shrink-0 text-[11px]">
                            {label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {event.repo && (
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {event.repo}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(event.occurredAt), 'h:mm a')}
                          </span>
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-0.5"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {event.type === 'chatgpt_conversation' && (event.rawPayload as any).messages && (
                          <div className="mt-3 space-y-2 border-l-2 border-muted pl-3 ml-1">
                            {((event.rawPayload as any).messages as any[]).map((msg, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-semibold text-xs text-muted-foreground uppercase">{msg.role}: </span>
                                <span className="text-muted-foreground">{msg.excerpt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
