// apps/web/src/pages/admin/AdminAuditPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AdminActionItem } from '@/lib/api';
import { ExportModal } from '@/components/admin/ExportModal';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Download,
  Clock,
  Key,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAuditPage() {
  const [actions, setActions] = useState<AdminActionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const fetchAdminActions = async () => {
    setLoading(true);
    try {
      const res = await admin.getAdminAudit({
        action: actionFilter !== 'all' ? actionFilter : undefined,
        search: search.trim() || undefined,
        page,
        limit: 50,
      });

      setActions(res.actions);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch {
      toast.error('Failed to load admin audit trail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminActions();
  }, [actionFilter, page]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-primary" /> Admin Governance & Audit Trail
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Immutable log of administrative operations, configuration changes, role updates, and system maintenance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportOpen(true)}
            className="text-xs h-8 gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> Export Admin Log
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={fetchAdminActions}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchAdminActions(); }} className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by admin email, action name, target ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs font-mono bg-card"
          />
        </form>
      </div>

      {/* Admin Actions Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
          <span>Found <strong className="text-foreground">{total}</strong> governance actions</span>
          <span className="font-mono text-[11px]">Page {page} of {totalPages}</span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {loading && actions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading admin actions...</span>
            </div>
          ) : actions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No administrative actions recorded matching your search.
            </div>
          ) : (
            actions.map((act) => (
              <div key={act.id} className="p-4 hover:bg-muted/40 transition-colors space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{act.action}</span>
                    {act.targetType && (
                      <Badge variant="secondary" className="text-[10px] uppercase h-4 px-1 py-0">
                        {act.targetType}: {act.targetId}
                      </Badge>
                    )}
                  </div>

                  <span className="text-muted-foreground text-[11px]">
                    {new Date(act.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="text-foreground font-medium flex items-center gap-1">
                    <Key className="h-3 w-3 text-primary" /> Admin: {act.adminEmail}
                  </span>
                  {act.ipAddress && <span>• IP: {act.ipAddress}</span>}
                </div>

                {act.details && Object.keys(act.details).length > 0 && (
                  <pre className="p-3 rounded-lg bg-muted/40 text-[11px] text-foreground overflow-x-auto">
                    {JSON.stringify(act.details, null, 2)}
                  </pre>
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
        category="admin_actions"
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
