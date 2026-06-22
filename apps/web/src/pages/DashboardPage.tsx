// apps/web/src/pages/DashboardPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  GitCommitHorizontal,
  GitPullRequest,
  Star,
  MessageSquare,
  Zap,
  RefreshCw,
  Send,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { dashboard, reports } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboard.getToday,
    refetchInterval: 60_000,
  })

  const generateMutation = useMutation({
    mutationFn: reports.generate,
    onSuccess: (data) => {
      toast.success('Report generation started! Check back in a moment.', {
        description: `Job ID: ${data.jobId}`,
      })
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      }, 5000)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div>
          <p className="font-semibold">Failed to load dashboard</p>
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const report = data?.report
  const github = data?.github
  const user = data?.user

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const reportStatus = report?.status
  const canSend = report && reportStatus === 'draft'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {isLoading ? (
            <Skeleton className="h-8 w-48 mb-2" />
          ) : (
            <h2 className="text-2xl font-bold">
              {greeting()}, {user?.name?.split(' ')[0]} 👋
            </h2>
          )}
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')} · {data?.timezone || 'UTC'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* GitHub sync status */}
          {github && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {github.lastSyncedAt
                ? `Synced ${formatDistanceToNow(new Date(github.lastSyncedAt))} ago`
                : 'Never synced'}
            </div>
          )}
        </div>
      </div>

      {/* GitHub not connected warning */}
      {!isLoading && !github && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">GitHub not connected</p>
              <p className="text-xs text-muted-foreground">Connect your GitHub account to start tracking activity.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/integrations')}>
              Connect GitHub
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<GitCommitHorizontal className="h-4 w-4 text-violet-400" />}
          label="Commits"
          value={stats?.commits}
          isLoading={isLoading}
          color="violet"
        />
        <StatCard
          icon={<GitPullRequest className="h-4 w-4 text-indigo-400" />}
          label="PRs"
          value={stats?.prsOpened}
          isLoading={isLoading}
          color="indigo"
        />
        <StatCard
          icon={<Star className="h-4 w-4 text-amber-400" />}
          label="Reviews"
          value={stats?.reviews}
          isLoading={isLoading}
          color="amber"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4 text-emerald-400" />}
          label="Issues"
          value={stats?.issues}
          isLoading={isLoading}
          color="emerald"
        />
      </div>

      {/* Report section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Today's AI Summary
                </CardTitle>
                <CardDescription>
                  {report?.generatedAt
                    ? `Generated ${formatDistanceToNow(new Date(report.generatedAt))} ago`
                    : 'No report generated yet'}
                </CardDescription>
              </div>
              {report && (
                <ReportStatusBadge status={report.status} />
              )}
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              ) : report ? (
                <div className="space-y-4">
                  {report.summary && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{report.summary}</p>
                  )}
                  {report.completedItems && report.completedItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Completed
                      </p>
                      <ul className="space-y-1.5">
                        {(report.completedItems as string[]).slice(0, 4).map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                        {(report.completedItems as string[]).length > 4 && (
                          <li className="text-xs text-muted-foreground pl-5">
                            +{(report.completedItems as string[]).length - 4} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/reports/${data?.date || 'today'}`)}
                    id="btn-view-report"
                  >
                    View full report →
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No report generated yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generate your EOD report from today's GitHub activity
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start gap-2"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              id="btn-generate-report"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {generateMutation.isPending ? 'Generating...' : 'Generate Report'}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate('/timeline')}
              id="btn-view-timeline"
            >
              <GitCommitHorizontal className="h-4 w-4" />
              View Timeline
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              disabled={!canSend}
              onClick={() => canSend && navigate(`/reports/${data?.date || 'today'}`)}
              id="btn-approve-send"
            >
              <Send className="h-4 w-4" />
              Approve & Send
            </Button>

            {!canSend && report?.status === 'sent' && (
              <p className="text-xs text-muted-foreground text-center">
                <CheckCircle2 className="h-3.5 w-3.5 inline mr-1 text-emerald-400" />
                Already sent today
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  isLoading,
  color,
}: {
  icon: React.ReactNode
  label: string
  value?: number
  isLoading: boolean
  color: string
}) {
  return (
    <Card className="stat-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${color}-500/10 ring-1 ring-${color}-500/20`}>
            {icon}
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-7 w-12 mb-1" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value ?? 0}</p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft': return <Badge variant="secondary">Draft</Badge>
    case 'sent': return <Badge variant="success">Sent</Badge>
    case 'failed': return <Badge variant="destructive">Failed</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}
