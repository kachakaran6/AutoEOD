import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { FileText, Loader2, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react'
import { reports } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ReportsHistoryPage() {
  const { data: reportsList, isLoading, error } = useQuery({
    queryKey: ['reports', 'list'],
    queryFn: reports.list,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Failed to load reports</h2>
        <p className="text-muted-foreground mt-2">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports History</h2>
        <p className="text-muted-foreground text-sm mt-1">
          View all your past End-of-Day reports
        </p>
      </div>

      <div className="space-y-3">
        {reportsList?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <div>
                <p className="font-semibold">No reports found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You haven't generated any reports yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          reportsList?.map((report) => (
            <Link key={report.id} to={`/reports/${report.reportDate}`} className="block">
              <Card className="hover:border-primary/50 transition-colors group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium text-base">
                        {format(new Date(report.reportDate + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
                      </span>
                      <div className="flex items-center gap-4">
                        <ReportStatusBadge status={report.status} />
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                    {report.errorMessage ? (
                      <span className="text-sm text-destructive line-clamp-1 max-w-2xl mt-1 font-medium bg-destructive/10 px-2 py-0.5 rounded w-fit">
                        Error: {report.errorMessage}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground line-clamp-1 max-w-2xl mt-1">
                        {report.summary || 'No summary available.'}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

function ReportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft': return <Badge variant="secondary">Draft</Badge>
    case 'sent': return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />Sent</Badge>
    case 'failed': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Gen Failed</Badge>
    case 'send_failed': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Send Failed</Badge>
    default: return <Badge variant="outline">{status}</Badge>
  }
}
