// apps/web/src/pages/admin/BackgroundJobsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Server,
  RefreshCw,
  RotateCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';

export default function BackgroundJobsPage() {
  const [queues, setQueues] = useState<Array<{ name: string; counts: any; recentJobs: any[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await admin.getJobs();
      setQueues(res.queues);
    } catch {
      toast.error('Failed to load background queues status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRetry = async (queueName: string, jobId: string) => {
    setRetryingId(jobId);
    try {
      await admin.retryJob(queueName, jobId);
      toast.success(`Job ${jobId} queued for retry`);
      fetchJobs();
    } catch {
      toast.error('Failed to retry job');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Server className="h-6 w-6 text-primary" /> BullMQ Background Jobs & Workers
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time queue monitoring, active worker threads, failed job investigation, and execution retries
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchJobs}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Queues
        </Button>
      </div>

      {/* Queue Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {queues.map((q) => (
          <Card key={q.name} className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-mono font-bold">{q.name}</CardTitle>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {q.counts.failed > 0 ? 'Degraded' : 'Active'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active:</span>
                <span className="font-bold text-sky-500">{q.counts.active || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Waiting:</span>
                <span className="font-medium text-foreground">{q.counts.waiting || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span className="font-medium text-emerald-500">{q.counts.completed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed:</span>
                <span className={`font-bold ${q.counts.failed > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                  {q.counts.failed || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Jobs Inspection Stream */}
      <div className="space-y-6">
        {queues.map((q) => (
          <Card key={`jobs-${q.name}`} className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                Queue: {q.name} ({q.recentJobs.length} recent jobs)
              </span>
            </div>

            <div className="divide-y divide-border/40 font-mono text-xs">
              {q.recentJobs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No recent jobs in this queue.</div>
              ) : (
                q.recentJobs.map((job) => {
                  const isFailed = !!job.failedReason;
                  return (
                    <div key={job.id} className="p-4 space-y-2 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              isFailed
                                ? 'bg-rose-500/15 text-rose-500 border-rose-500/30 text-[10px]'
                                : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]'
                            }
                          >
                            {isFailed ? 'FAILED' : 'COMPLETED'}
                          </Badge>
                          <span className="font-bold text-foreground">Job #{job.id}</span>
                          <span className="text-muted-foreground">• {job.name}</span>
                        </div>

                        <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                          <span>Attempts: {job.attemptsMade}</span>
                          <span>•</span>
                          <span>{job.timestamp ? new Date(job.timestamp).toLocaleTimeString() : ''}</span>
                          {isFailed && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={retryingId === job.id}
                              onClick={() => handleRetry(q.name, job.id)}
                              className="h-7 text-xs gap-1 font-sans text-rose-500 hover:text-rose-600"
                            >
                              <RotateCw className={`h-3 w-3 ${retryingId === job.id ? 'animate-spin' : ''}`} /> Retry
                            </Button>
                          )}
                        </div>
                      </div>

                      {job.data && Object.keys(job.data).length > 0 && (
                        <pre className="p-3 rounded-lg bg-muted/30 text-[11px] text-foreground overflow-x-auto">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      )}

                      {job.failedReason && (
                        <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-rose-300 text-[11px]">
                          <strong>Failure Reason:</strong> {job.failedReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
