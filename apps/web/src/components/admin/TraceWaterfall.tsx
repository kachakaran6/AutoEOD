// apps/web/src/components/admin/TraceWaterfall.tsx
import React, { useState } from 'react';
import { SpanItem, TraceDetailResponse } from '@/lib/api';
import { StatusBadge } from './StatusBadges';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Clock,
  Layers,
  ChevronRight,
  ChevronDown,
  Database,
  Cpu,
  Globe,
  Mail,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface TraceWaterfallProps {
  trace: TraceDetailResponse;
}

export function TraceWaterfall({ trace }: TraceWaterfallProps) {
  const [selectedSpan, setSelectedSpan] = useState<SpanItem | null>(trace.spans[0] || null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const totalDuration = Math.max(1, trace.durationMs || 100);
  const traceStart = trace.startTime;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getServiceColor = (service: string) => {
    switch (service.toLowerCase()) {
      case 'database':
      case 'postgres':
        return 'bg-blue-500';
      case 'redis':
      case 'cache':
        return 'bg-rose-500';
      case 'ai':
      case 'openai':
      case 'openrouter':
        return 'bg-purple-500';
      case 'email':
      case 'resend':
        return 'bg-amber-500';
      case 'worker':
      case 'job':
        return 'bg-indigo-500';
      default:
        return 'bg-primary';
    }
  };

  const getSpanIcon = (kind: string, service: string) => {
    if (service.toLowerCase().includes('database') || service.toLowerCase().includes('postgres')) {
      return <Database className="h-3.5 w-3.5 text-blue-500" />;
    }
    if (service.toLowerCase().includes('ai')) {
      return <Cpu className="h-3.5 w-3.5 text-purple-500" />;
    }
    if (service.toLowerCase().includes('email')) {
      return <Mail className="h-3.5 w-3.5 text-amber-500" />;
    }
    return <Globe className="h-3.5 w-3.5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      {/* Trace Summary Banner */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <StatusBadge status={trace.status} />
                <span className="font-mono text-sm font-semibold">{trace.rootSpanName}</span>
                {trace.httpRoute && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {trace.httpMethod} {trace.httpRoute}
                  </Badge>
                )}
                {trace.httpStatus && (
                  <Badge
                    className={cn(
                      'font-mono text-xs',
                      trace.httpStatus >= 500
                        ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                        : trace.httpStatus >= 400
                        ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                    )}
                  >
                    HTTP {trace.httpStatus}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 font-mono">
                Trace ID: <span className="text-foreground">{trace.traceId}</span> • Started at:{' '}
                {new Date(trace.startTime).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <div className="text-muted-foreground">Total Duration</div>
                <div className="text-base font-bold text-foreground">{trace.durationMs} ms</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Spans</div>
                <div className="text-base font-bold text-primary">{trace.spanCount}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8 font-sans"
                onClick={() => copyToClipboard(trace.traceId, 'Trace ID')}
              >
                {copiedKey === 'Trace ID' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy ID
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waterfall & Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Waterfall Spans List */}
        <Card className="lg:col-span-7 border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" /> Spans & Operations ({trace.spans.length})
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">0ms ────────── {totalDuration}ms</span>
          </div>

          <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto">
            {trace.spans.map((span) => {
              const spanDuration = span.durationMs || 1;
              const offsetMs = Math.max(0, span.startTime - traceStart);
              const leftPercent = Math.min(95, Math.max(0, (offsetMs / totalDuration) * 100));
              const widthPercent = Math.max(2, Math.min(100 - leftPercent, (spanDuration / totalDuration) * 100));
              const isSelected = selectedSpan?.spanId === span.spanId;
              const hasError = span.status === 'ERROR' || !!span.error;

              return (
                <div
                  key={span.spanId}
                  onClick={() => setSelectedSpan(span)}
                  className={cn(
                    'p-3.5 cursor-pointer transition-colors text-xs space-y-2',
                    isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getSpanIcon(span.kind, span.service)}
                      <span className="font-semibold text-foreground truncate">{span.name}</span>
                      <Badge variant="outline" className="text-[10px] font-mono px-1 py-0 h-4 uppercase">
                        {span.service}
                      </Badge>
                      {hasError && (
                        <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30 text-[10px] px-1 py-0 h-4">
                          ERROR
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-muted-foreground font-medium shrink-0">
                      {span.durationMs !== undefined ? `${span.durationMs}ms` : 'pending'}
                    </span>
                  </div>

                  {/* Waterfall Bar */}
                  <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden relative">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        hasError ? 'bg-rose-500' : getServiceColor(span.service)
                      )}
                      style={{
                        marginLeft: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Selected Span Inspector */}
        <Card className="lg:col-span-5 border-border/60 bg-card/60 backdrop-blur-sm sticky top-6">
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Span Attributes & Events
            </span>
            {selectedSpan && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => copyToClipboard(JSON.stringify(selectedSpan, null, 2), 'Span JSON')}
              >
                {copiedKey === 'Span JSON' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy
              </Button>
            )}
          </div>

          <CardContent className="p-5 space-y-4 max-h-[600px] overflow-y-auto text-xs">
            {selectedSpan ? (
              <>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px]">Operation Name</span>
                  <div className="font-mono font-semibold text-sm text-foreground">{selectedSpan.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-muted-foreground">Span ID</div>
                    <div className="font-semibold text-foreground truncate">{selectedSpan.spanId}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-muted-foreground">Kind</div>
                    <div className="font-semibold text-foreground">{selectedSpan.kind}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-muted-foreground">Service</div>
                    <div className="font-semibold text-foreground">{selectedSpan.service}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60">
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-semibold text-primary">{selectedSpan.durationMs} ms</div>
                  </div>
                </div>

                {selectedSpan.error && (
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 font-mono space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" /> Error in Span
                    </div>
                    <div className="text-[11px] break-words">{selectedSpan.error.message}</div>
                    {selectedSpan.error.stack && (
                      <pre className="text-[10px] opacity-80 overflow-x-auto">{selectedSpan.error.stack}</pre>
                    )}
                  </div>
                )}

                {selectedSpan.attributes && Object.keys(selectedSpan.attributes).length > 0 && (
                  <div>
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Attributes
                    </span>
                    <pre className="p-3.5 rounded-xl bg-muted/40 border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                      {JSON.stringify(selectedSpan.attributes, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">Select a span from the waterfall to inspect</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
