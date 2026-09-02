// apps/web/src/pages/admin/SchedulerLogsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, StructuredLogItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CalendarClock,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SchedulerLogsPage() {
  const [schedulers, setSchedulers] = useState<any[]>([]);
  const [logs, setLogs] = useState<StructuredLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScheduler = async () => {
    setLoading(true);
    try {
      const res = await admin.getScheduler();
      setSchedulers(res.schedulers);
      setLogs(res.recentExecutionLogs);
    } catch {
      toast.error('Failed to load scheduler info');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduler();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CalendarClock className="h-6 w-6 text-primary" /> Scheduler & Recurring Cron Jobs
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Cron dispatcher triggers, next scheduled execution times, execution intervals, and run logs
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchScheduler}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Scheduler
        </Button>
      </div>

      {/* Repeatable Jobs Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Active Cron Schedulers ({schedulers.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left divide-y divide-border/60">
            <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Queue & Job Name</th>
                <th className="px-4 py-3">Cron / Interval</th>
                <th className="px-4 py-3">Next Scheduled Run</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {schedulers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No repeatable cron schedulers registered.
                  </td>
                </tr>
              ) : (
                schedulers.map((s) => (
                  <tr key={s.key} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">queue: {s.queueName}</div>
                    </td>
                    <td className="px-4 py-3 text-primary font-bold">
                      {s.cron || (s.every ? `Every ${Math.floor(s.every / 1000)}s` : 'Ad-hoc')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.next ? new Date(s.next).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status="ACTIVE" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Execution Logs */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent Scheduler Execution Logs ({logs.length})
          </span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs max-h-[500px] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent scheduler execution logs.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-muted/40 transition-colors space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">{log.service}</Badge>
                    {log.action && <span className="text-primary font-semibold">{log.action}</span>}
                  </div>
                  {log.durationMs !== undefined && <span>{log.durationMs}ms</span>}
                </div>
                <p className="text-foreground text-xs font-sans">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
