// apps/web/src/pages/admin/UserAuditPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, AuditEventItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { ExportModal } from '@/components/admin/ExportModal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  RefreshCw,
  Download,
  Clock,
  ArrowRight,
  ExternalLink,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

export default function UserAuditPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fetchAuditEvents = async () => {
    setLoading(true);
    try {
      const res = await admin.getUserAudit({
        category: category !== 'all' ? category : undefined,
        search: search.trim() || undefined,
        page,
        limit: 50,
      });

      setEvents(res.events);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to load user audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [category, page]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary" /> User Activity & Audit Trail
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable, append-only audit trail capturing user authentication, report generations, configuration changes, and integration events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Audit Trail
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={fetchAuditEvents}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchAuditEvents(); }} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by action, email, user ID, IP address, trace ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs font-mono bg-card"
          />
        </form>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-auto"
        >
          <option value="all">Category: ALL</option>
          <option value="auth">auth</option>
          <option value="user">user</option>
          <option value="report">report</option>
          <option value="integration">integration</option>
          <option value="ai">ai</option>
          <option value="email">email</option>
          <option value="system">system</option>
        </select>
      </div>

      {/* Audit Events Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> immutable audit events</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading audit trail...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No audit events found matching your filter criteria.
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="p-4 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={ev.status} />
                    <span className="font-bold text-foreground font-mono text-xs">{ev.action}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase h-4 px-1 py-0">
                      {ev.category}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 flex-wrap">
                    <span className="text-foreground font-medium">{ev.actorEmail || ev.actorId || 'System'}</span>
                    <span>•</span>
                    <span>{new Date(ev.timestamp).toLocaleString()}</span>
                    {ev.ipAddress && <span>• IP: {ev.ipAddress}</span>}
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
                    <div className="text-[11px] text-muted-foreground font-mono truncate max-w-3xl pt-0.5">
                      {JSON.stringify(ev.details)}
                    </div>
                  )}
                </div>

                {ev.actorId && (
                  <div className="shrink-0 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 font-sans"
                      onClick={() => navigate(`/admin/audit/users/${ev.actorId}/timeline`)}
                    >
                      <History className="h-3.5 w-3.5 text-primary" /> User Timeline
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
        category="audit_events"
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
