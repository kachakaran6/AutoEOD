// apps/web/src/pages/admin/TraceDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { admin, TraceDetailResponse } from '@/lib/api';
import { TraceWaterfall } from '@/components/admin/TraceWaterfall';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const [trace, setTrace] = useState<TraceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTraceDetail = async () => {
    if (!traceId) return;
    setLoading(true);
    try {
      const res = await admin.getTraceDetail(traceId);
      setTrace(res);
    } catch {
      toast.error('Trace not found or expired from ring buffer');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraceDetail();
  }, [traceId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/traces')}
          className="gap-2 text-xs h-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Traces
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTraceDetail}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Trace
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Loading trace spans & timeline...</p>
        </div>
      ) : !trace ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold">Trace Not Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            The trace <span className="font-mono text-foreground font-semibold">{traceId}</span> may have expired from
            the sliding window memory buffer or was not recorded.
          </p>
          <Button variant="default" size="sm" onClick={() => navigate('/admin/traces')}>
            Return to Traces List
          </Button>
        </div>
      ) : (
        <TraceWaterfall trace={trace} />
      )}
    </div>
  );
}
