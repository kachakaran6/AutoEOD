// apps/web/src/pages/admin/LogsExplorerPage.tsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { admin, StructuredLogItem, LogsQueryResponse } from '@/lib/api';
import { LevelBadge, StatusBadge } from '@/components/admin/StatusBadges';
import { LogDetailDrawer } from '@/components/admin/LogDetailDrawer';
import { ExportModal } from '@/components/admin/ExportModal';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ScrollText,
  Search,
  RefreshCw,
  Download,
  Filter,
  Layers,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'all', label: 'All Logs' },
  { id: 'app', label: 'Application' },
  { id: 'api', label: 'API Requests' },
  { id: 'security', label: 'Security' },
  { id: 'jobs', label: 'Background Jobs' },
  { id: 'ai', label: 'AI Subsystem' },
  { id: 'integration', label: 'Integrations' },
  { id: 'email', label: 'Email' },
];

const LEVELS = ['all', 'error', 'warn', 'info', 'debug'];

export default function LogsExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<StructuredLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  // Filters state initialized from URL search params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [level, setLevel] = useState(searchParams.get('level') || 'all');
  const [service, setService] = useState(searchParams.get('service') || 'all');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Modals & drawers
  const [selectedLog, setSelectedLog] = useState<StructuredLogItem | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await admin.getLogs({
        category: category !== 'all' ? category : undefined,
        level: level !== 'all' ? level : undefined,
        service: service !== 'all' ? service : undefined,
        search: search.trim() || undefined,
        page,
        limit: 50,
      });

      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to query logs');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [category, level, service, page]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => fetchLogs(false), 3000);
    return () => clearInterval(interval);
  }, [isLive, category, level, service, search, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ScrollText className="h-6 w-6 text-primary" /> Logs Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Query structured JSON logs across API, Background Workers, AI, Integrations, and Security
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="text-xs h-8 gap-1.5"
          >
            <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
            {isLive ? 'Live Tail (3s)' : 'Pause Stream'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Logs
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => fetchLogs(true)}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/60">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat.id}
            variant={category === cat.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setCategory(cat.id);
              setPage(1);
            }}
            className="h-8 text-xs font-medium shrink-0 rounded-lg"
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by keyword, traceId, requestId, action, userId..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs font-mono bg-card"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Level Filter */}
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Level: ALL</option>
            <option value="error">ERROR</option>
            <option value="warn">WARN</option>
            <option value="info">INFO</option>
            <option value="debug">DEBUG</option>
          </select>

          {/* Service Filter */}
          <select
            value={service}
            onChange={(e) => {
              setService(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Service: ALL</option>
            <option value="api">api</option>
            <option value="worker">worker</option>
          </select>
        </div>
      </div>

      {/* Logs Table / Stream */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> structured log entries</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Fetching logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No log entries match your filter criteria.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="p-3.5 hover:bg-muted/40 cursor-pointer transition-colors flex items-start justify-between gap-4 group"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="shrink-0 pt-0.5">
                    <LevelBadge level={log.level} />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                      <span className="text-foreground font-semibold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span className="font-semibold text-primary">{log.service}</span>
                      {log.category && (
                        <Badge variant="outline" className="text-[10px] uppercase font-sans h-4 px-1 py-0">
                          {log.category}
                        </Badge>
                      )}
                      {log.action && (
                        <span className="text-foreground font-mono font-medium">{log.action}</span>
                      )}
                      {log.durationMs !== undefined && (
                        <span className="text-emerald-500">{log.durationMs}ms</span>
                      )}
                    </div>

                    <div className="text-xs text-foreground truncate max-w-4xl font-sans">
                      {log.message}
                    </div>

                    {(log.traceId || log.userId) && (
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                        {log.traceId && (
                          <span className="text-primary truncate">trace: {log.traceId}</span>
                        )}
                        {log.userId && (
                          <span className="truncate">user: {log.userEmail || log.userId}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
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

      {/* Log Inspection Drawer */}
      <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />

      {/* Export Modal */}
      <ExportModal
        category={category}
        filters={{ level, service, search }}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
