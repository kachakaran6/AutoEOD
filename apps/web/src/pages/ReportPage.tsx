// apps/web/src/pages/ReportPage.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Zap,
  Save,
  Send,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import { reports } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export function ReportPage() {
  const { date = 'today' } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const reportDate = date === 'today' ? format(new Date(), 'yyyy-MM-dd') : date

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['report', reportDate],
    queryFn: () => reports.getByDate(reportDate),
    retry: false,
  })

  // Editable form state
  const [summary, setSummary] = useState('')
  const [completedItems, setCompletedItems] = useState<string[]>([])
  const [inProgressItems, setInProgressItems] = useState<string[]>([])
  const [blockers, setBlockers] = useState('')
  const [tomorrowPlan, setTomorrowPlan] = useState('')

  // Sync form with fetched report
  useEffect(() => {
    if (report) {
      setSummary(report.summary || '')
      setCompletedItems(report.completedItems || [])
      setInProgressItems(report.inProgressItems || [])
      setBlockers(report.blockers || '')
      setTomorrowPlan(report.tomorrowPlan || '')
    }
  }, [report])

  const saveMutation = useMutation({
    mutationFn: () =>
      reports.update(report!.id, {
        summary,
        completedItems,
        inProgressItems,
        blockers: blockers || null,
        tomorrowPlan,
      }),
    onSuccess: () => {
      toast.success('Report saved')
      queryClient.invalidateQueries({ queryKey: ['report', reportDate] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const regenerateMutation = useMutation({
    mutationFn: () => reports.regenerate(report!.id),
    onSuccess: () => {
      toast.success('Regenerating report... This may take a moment.')
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['report', reportDate] }), 8000)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const sendMutation = useMutation({
    mutationFn: () => reports.send(report!.id),
    onSuccess: (updated) => {
      toast.success(`Report sent to ${updated.sentTo}!`)
      queryClient.invalidateQueries({ queryKey: ['report', reportDate] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err: Error) => toast.error(`Failed to send: ${err.message}`, { duration: 8000 }),
  })

  const generateMutation = useMutation({
    mutationFn: reports.generate,
    onSuccess: () => {
      toast.success('Report generation started! Refresh in a moment.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const isSent = report?.status === 'sent'
  const isFailed = report?.status === 'failed'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">EOD Report</h2>
          <p className="text-muted-foreground text-sm mt-1">{reportDate}</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <Clock className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-semibold">No report found for {reportDate}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate your EOD report from today's GitHub activity
              </p>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              id="btn-generate-from-empty"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Generate Report
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">EOD Report</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(reportDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
            {report.aiModel && ` · Generated by ${report.aiModel}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ReportStatusBadge status={report.status} />
        </div>
      </div>

      {/* Failed error */}
      {isFailed && report.errorMessage && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Report generation failed</p>
              <p className="text-xs text-muted-foreground mt-1">{report.errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sent info */}
      {isSent && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-sm">
              Sent to <strong>{report.sentTo}</strong>
              {report.sentAt && ` at ${format(new Date(report.sentAt), 'h:mm a')}`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Editable form */}
      <div className="space-y-5">
        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="report-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="2-3 sentence overview of your day..."
              rows={3}
              disabled={isSent}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Completed items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                ✅ Completed Today
              </CardTitle>
              {!isSent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCompletedItems([...completedItems, ''])}
                  id="btn-add-completed"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {completedItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <Input
                  value={item}
                  onChange={(e) => {
                    const updated = [...completedItems]
                    updated[i] = e.target.value
                    setCompletedItems(updated)
                  }}
                  placeholder="What did you complete?"
                  disabled={isSent}
                  className="flex-1"
                />
                {!isSent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setCompletedItems(completedItems.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {completedItems.length === 0 && (
              <p className="text-sm text-muted-foreground">No completed items yet</p>
            )}
          </CardContent>
        </Card>

        {/* In progress items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                🔄 In Progress
              </CardTitle>
              {!isSent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInProgressItems([...inProgressItems, ''])}
                  id="btn-add-inprogress"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {inProgressItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-400 shrink-0" />
                <Input
                  value={item}
                  onChange={(e) => {
                    const updated = [...inProgressItems]
                    updated[i] = e.target.value
                    setInProgressItems(updated)
                  }}
                  placeholder="What's still in progress?"
                  disabled={isSent}
                  className="flex-1"
                />
                {!isSent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setInProgressItems(inProgressItems.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {inProgressItems.length === 0 && (
              <p className="text-sm text-muted-foreground">No in-progress items</p>
            )}
          </CardContent>
        </Card>

        {/* Blockers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              🚧 Blockers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="report-blockers"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Any blockers? Leave blank if none."
              rows={2}
              disabled={isSent}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Tomorrow's plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              📅 Tomorrow's Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="report-tomorrow"
              value={tomorrowPlan}
              onChange={(e) => setTomorrowPlan(e.target.value)}
              placeholder="What's the plan for tomorrow?"
              rows={2}
              disabled={isSent}
              className="resize-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      {!isSent && (
        <div className="flex items-center gap-3 pt-2 pb-4 sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border -mx-6 px-6">
          <Button
            variant="outline"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending || saveMutation.isPending}
            id="btn-regenerate-report"
          >
            {regenerateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate
          </Button>

          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !report}
            id="btn-save-draft"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Draft
          </Button>

          <div className="flex-1" />

          <Button
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || !report}
            className="gap-2"
            id="btn-approve-send-report"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Approve & Send
          </Button>
        </div>
      )}
    </div>
  )
}

function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft': return <Badge variant="secondary">Draft</Badge>
    case 'sent': return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Sent</Badge>
    case 'failed': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}
