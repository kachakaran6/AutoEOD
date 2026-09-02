// apps/web/src/pages/admin/TracesPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, TraceSummaryItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  GitBranch,
  Search,
  RefreshCw,
  Clock,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TracesPage() {
  const navigate = useNavigate();
  const [traces, setTraces] = useState<TraceSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [service, setService] = useState('all');
  const [minDurationMs, setMinDurationMs] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  const fetchTraces = async () => {
    setLoading(true);
    try {
      const res = await admin.getTraces({
        status: status !== 'all' ? status : undefined,
        service: service !== 'all' ? service : undefined,
        search: search.trim() || undefined,
        minDurationMs,
        page,
        limit: 50,
      });

      setTraces(res.traces);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to query traces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraces();
  }, [status, service, minDurationMs, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTraces();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GitBranch className="h-6 w-6 text-primary" /> Distributed Tracing
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            End-to-end request lifecycle and OpenTelemetry waterfall across HTTP, DB, Cache, Workers, and External APIs
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchTraces}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Trace ID, route, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs font-mono bg-card"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Status: ALL</option>
            <option value="OK">OK</option>
            <option value="ERROR">ERROR</option>
          </select>

          {/* Min Duration Filter */}
          <select
            value={minDurationMs !== undefined ? String(minDurationMs) : 'all'}
            onChange={(e) => {
              setMinDurationMs(e.target.value === 'all' ? undefined : parseInt(e.target.value));
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Duration: ALL</option>
            <option value="200">&gt; 200ms</option>
            <option value="500">&gt; 500ms (Slow)</option>
            <option value="1000">&gt; 1000ms</option>
          </select>
        </div>
      </div>

      {/* Traces Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> distributed traces</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && traces.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading traces...</span>
            </div>
          ) : traces.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No distributed traces recorded matching your filter.
            </div>
          ) : (
            traces.map((trace) => (
              <div
                key={trace.traceId}
                onClick={() => navigate(`/admin/traces/${trace.traceId}`)}
                className="p-3.5 hover:bg-muted/40 cursor-pointer transition-colors flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <StatusBadge status={trace.status} />

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground font-mono text-xs">{trace.rootSpanName}</span>
                      {trace.httpStatus && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
                          {trace.httpMethod} {trace.httpStatus}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] uppercase h-4 px-1 py-0">
                        {trace.service}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="text-primary truncate">trace: {trace.traceId}</span>
                      <span>•</span>
                      <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
                      {trace.userEmail && <span>• user: {trace.userEmail}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div>
                    <div className="text-xs font-bold text-foreground font-mono">{trace.durationMs} ms</div>
                    <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1">
                      <Layers className="h-3 w-3" /> {trace.spanCount} spans
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
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
    </div>
  );
}
