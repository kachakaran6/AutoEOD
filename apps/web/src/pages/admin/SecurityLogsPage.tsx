// apps/web/src/pages/admin/SecurityLogsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, SecurityEventItem } from '@/lib/api';
import { SeverityBadge, StatusBadge } from '@/components/admin/StatusBadges';
import { ExportModal } from '@/components/admin/ExportModal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Download,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SecurityLogsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('all');
  const [page, setPage] = useState(1);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fetchSecurityEvents = async () => {
    setLoading(true);
    try {
      const res = await admin.getSecurityLogs({
        severity: severity !== 'all' ? severity : undefined,
        search: search.trim() || undefined,
        page,
        limit: 50,
      });

      setEvents(res.events);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to load security logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityEvents();
  }, [severity, page]);

  const handleResolve = async (id: string) => {
    try {
      await admin.resolveSecurityEvent(id);
      toast.success('Security incident marked as resolved');
      fetchSecurityEvents();
    } catch {
      toast.error('Failed to resolve security incident');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-rose-500" /> Security Incidents & Threat Logs
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time security events including authentication failures, brute-force detections, rate limit violations, and permission denials
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Security Logs
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={fetchSecurityEvents}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchSecurityEvents(); }} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by event type, user email, IP address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs font-mono bg-card"
          />
        </form>

        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-auto"
        >
          <option value="all">Severity: ALL</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>
      </div>

      {/* Security Events Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> security events</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading security incidents...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No security incidents recorded. System is secure.
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="p-4 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={ev.severity} />
                    <span className="font-bold text-foreground text-xs">{ev.eventType}</span>
                    {ev.route && (
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {ev.method} {ev.route}
                      </Badge>
                    )}
                    {ev.resolved ? (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">
                        RESOLVED
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30 text-[10px]">
                        OPEN
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5 flex-wrap">
                    {ev.userEmail && <span>User: <strong className="text-foreground">{ev.userEmail}</strong></span>}
                    {ev.ipAddress && <span>IP: <strong className="text-foreground">{ev.ipAddress}</strong></span>}
                    <span>•</span>
                    <span>{new Date(ev.timestamp).toLocaleString()}</span>
                    {ev.traceId && (
                      <button
                        onClick={() => navigate(`/admin/traces/${ev.traceId}`)}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Trace <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {ev.details && Object.keys(ev.details).length > 0 && (
                    <pre className="p-3 rounded-lg bg-muted/40 text-[11px] text-foreground overflow-x-auto">
                      {JSON.stringify(ev.details, null, 2)}
                    </pre>
                  )}
                </div>

                {!ev.resolved && (
                  <div className="shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-emerald-500 hover:text-emerald-600 font-sans"
                      onClick={() => handleResolve(ev.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Pagination Controls */}
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

      {/* Export Modal */}
      <ExportModal
        category="security_events"
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
