// apps/web/src/pages/admin/ErrorTrackerPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, ErrorGroupItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertOctagon,
  Search,
  RefreshCw,
  Users,
  Clock,
  CheckCircle2,
  EyeOff,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ErrorTrackerPage() {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<ErrorGroupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('UNRESOLVED');
  const [service, setService] = useState('all');
  const [page, setPage] = useState(1);

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const res = await admin.getErrors({
        status: status !== 'all' ? status : undefined,
        service: service !== 'all' ? service : undefined,
        search: search.trim() || undefined,
        page,
        limit: 50,
      });

      setErrors(res.errors);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to load error groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, [status, service, page]);

  const handleUpdateStatus = async (e: React.MouseEvent, id: string, newStatus: 'UNRESOLVED' | 'RESOLVED' | 'IGNORED') => {
    e.stopPropagation();
    try {
      await admin.updateErrorStatus(id, newStatus);
      toast.success(`Error marked as ${newStatus.toLowerCase()}`);
      fetchErrors();
    } catch {
      toast.error('Failed to update error status');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <AlertOctagon className="h-6 w-6 text-rose-500" /> Error Tracker & Diagnostics
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Sentry-style error grouping with deterministic fingerprints, occurrence tracking, stack traces, and affected users
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchErrors}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchErrors(); }} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search errors by name, message, stack trace..."
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
            <option value="UNRESOLVED">UNRESOLVED</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="IGNORED">IGNORED</option>
            <option value="all">Status: ALL</option>
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

      {/* Errors Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> error groups</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && errors.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading errors...</span>
            </div>
          ) : errors.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No errors found matching your filter criteria.
            </div>
          ) : (
            errors.map((group) => (
              <div
                key={group.id}
                onClick={() => navigate(`/admin/errors/${group.id}`)}
                className="p-4 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-rose-500 font-mono text-xs">{group.name}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase h-4 px-1 py-0">
                      {group.service}
                    </Badge>
                    <StatusBadge status={group.status} />
                  </div>

                  <p className="text-xs text-foreground font-sans truncate max-w-4xl">
                    {group.message}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-primary">
                      <Clock className="h-3 w-3" /> Last seen: {new Date(group.lastSeen).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {group.affectedUsersCount} affected users
                    </span>
                    <span>fingerprint: {group.fingerprint.slice(0, 8)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                  <div className="text-right">
                    <div className="text-sm font-bold text-foreground">{group.totalOccurrences}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">events</div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {group.status === 'UNRESOLVED' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 hover:text-emerald-500 font-sans"
                        onClick={(e) => handleUpdateStatus(e, group.id, 'RESOLVED')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 font-sans"
                        onClick={(e) => handleUpdateStatus(e, group.id, 'UNRESOLVED')}
                      >
                        Reopen
                      </Button>
                    )}

                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
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
