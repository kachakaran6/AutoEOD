// apps/web/src/components/admin/LogDetailDrawer.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StructuredLogItem } from '@/lib/api';
import { LevelBadge, StatusBadge } from './StatusBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  X,
  Copy,
  Check,
  GitBranch,
  Terminal,
  Clock,
  User,
  Activity,
  AlertCircle,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LogDetailDrawerProps {
  log: StructuredLogItem | null;
  onClose: () => void;
}

export function LogDetailDrawer({ log, onClose }: LogDetailDrawerProps) {
  const navigate = useNavigate();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!log) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <LevelBadge level={log.level} />
            <span className="font-mono text-xs text-muted-foreground">{log.service}</span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => copyToClipboard(JSON.stringify(log, null, 2), 'Log JSON')}
            >
              {copiedKey === 'Log JSON' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              Copy JSON
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main message */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Log Message</p>
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 font-mono text-xs text-foreground break-words leading-relaxed">
              {log.message}
            </div>
          </div>

          {/* Quick IDs & Correlations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {log.traceId && (
              <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Trace ID</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(log.traceId!, 'Trace ID')}
                  >
                    {copiedKey === 'Trace ID' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-primary truncate">{log.traceId}</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-primary gap-1"
                    onClick={() => {
                      onClose();
                      navigate(`/admin/traces/${log.traceId}`);
                    }}
                  >
                    View Trace <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {log.requestId && (
              <div className="p-3 rounded-xl bg-card border border-border/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Request ID</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(log.requestId!, 'Request ID')}
                  >
                    {copiedKey === 'Request ID' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <span className="font-mono text-xs font-semibold text-foreground truncate block">{log.requestId}</span>
              </div>
            )}
          </div>

          {/* Key Attributes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attributes</p>
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border text-xs">
              <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="font-mono">{log.timestamp}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                <span className="text-muted-foreground">Service</span>
                <span className="font-mono font-medium">{log.service}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                <span className="text-muted-foreground">Environment</span>
                <span className="font-mono uppercase">{log.environment}</span>
              </div>
              {log.action && (
                <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                  <span className="text-muted-foreground">Action / Event</span>
                  <span className="font-mono font-semibold text-primary">{log.action}</span>
                </div>
              )}
              {log.userId && (
                <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                  <span className="text-muted-foreground">User</span>
                  <span className="font-mono">{log.userEmail || log.userId}</span>
                </div>
              )}
              {log.durationMs !== undefined && (
                <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-mono font-semibold">{log.durationMs} ms</span>
                </div>
              )}
              {log.status !== undefined && (
                <div className="flex justify-between px-3.5 py-2.5 bg-muted/10">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-mono">{String(log.status)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Details if available */}
          {log.error && (
            <div>
              <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Error Stack Trace
              </p>
              <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 font-mono text-xs text-rose-300 overflow-x-auto whitespace-pre leading-relaxed">
                <div className="font-bold mb-2">{log.error.name}: {log.error.message}</div>
                <div className="text-[11px] opacity-90">{log.error.stack || 'No stack trace available'}</div>
              </div>
            </div>
          )}

          {/* Metadata JSON */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Metadata</p>
              <pre className="p-4 rounded-xl bg-muted/30 border border-border font-mono text-xs text-foreground overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
