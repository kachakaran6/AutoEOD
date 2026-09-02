// apps/web/src/pages/admin/EmailLogsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AuditEventItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  RefreshCw,
  Send,
  CheckCircle2,
  Clock,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

export default function EmailLogsPage() {
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchEmailLogs = async () => {
    setLoading(true);
    try {
      const res = await admin.getEmailLogs({ page, limit: 50 });
      setEvents(res.events);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to load email delivery logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailLogs();
  }, [page]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Mail className="h-6 w-6 text-primary" /> Email Deliveries & Notification Logs
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            End-of-day report emails, delivery receipts, template rendering, and notification status (with automatic email masking)
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchEmailLogs}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Email Delivery Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> email delivery events</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading email deliveries...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No email delivery events recorded yet.
            </div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="p-4 hover:bg-muted/40 transition-colors space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ev.status} />
                    <span className="font-bold text-foreground">{ev.action}</span>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Recipient: <strong className="text-foreground">{ev.actorEmail || 'System'}</strong></span>
                  {ev.resourceId && <span>• Report ID: {ev.resourceId}</span>}
                </div>

                {ev.details && Object.keys(ev.details).length > 0 && (
                  <pre className="p-3 rounded-lg bg-muted/30 text-[11px] text-foreground overflow-x-auto">
                    {JSON.stringify(ev.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-border/60 flex items-center justify-between text-xs bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="h-8 text-xs"
            >
              Previous
            </Button>
            <span className="text-muted-foreground font-mono">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="h-8 text-xs"
            >
              Next
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
