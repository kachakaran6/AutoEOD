// apps/web/src/pages/admin/ErrorDetailPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { admin, ErrorDetailResponse } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  EyeOff,
  Clock,
  Users,
  Code2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ErrorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<ErrorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await admin.getErrorDetail(id);
      setGroup(res);
    } catch {
      toast.error('Failed to load error details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const handleStatusChange = async (status: 'UNRESOLVED' | 'RESOLVED' | 'IGNORED') => {
    if (!id) return;
    try {
      await admin.updateErrorStatus(id, status);
      toast.success(`Error status updated to ${status}`);
      fetchDetail();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const copyStackTrace = () => {
    if (!group?.sampleStackTrace) return;
    navigator.clipboard.writeText(group.sampleStackTrace);
    setCopied(true);
    toast.success('Stack trace copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/errors')}
          className="gap-2 text-xs h-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Errors
        </Button>

        <div className="flex items-center gap-2">
          {group && (
            <>
              {group.status !== 'RESOLVED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('RESOLVED')}
                  className="gap-1.5 text-xs h-8 text-emerald-500 hover:text-emerald-600"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                </Button>
              )}
              {group.status !== 'IGNORED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('IGNORED')}
                  className="gap-1.5 text-xs h-8 text-muted-foreground"
                >
                  <EyeOff className="h-3.5 w-3.5" /> Ignore
                </Button>
              )}
              {group.status !== 'UNRESOLVED' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('UNRESOLVED')}
                  className="gap-1.5 text-xs h-8"
                >
                  Reopen Issue
                </Button>
              )}
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchDetail}
            disabled={loading}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Loading error details...</p>
        </div>
      ) : !group ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          Error group not found.
        </div>
      ) : (
        <>
          {/* Main Error Group Summary */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <StatusBadge status={group.status} />
                    <span className="font-mono text-base font-bold text-rose-500">{group.name}</span>
                    <Badge variant="secondary" className="font-mono text-xs uppercase">{group.service}</Badge>
                  </div>
                  <h2 className="text-sm text-foreground font-medium">{group.message}</h2>
                </div>

                <div className="flex items-center gap-6 text-xs font-mono">
                  <div className="text-right">
                    <div className="text-muted-foreground">Occurrences</div>
                    <div className="text-lg font-bold text-foreground">{group.totalOccurrences}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-muted-foreground">Affected Users</div>
                    <div className="text-lg font-bold text-primary">{group.affectedUsersCount}</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center gap-6 text-xs font-mono text-muted-foreground flex-wrap">
                <span>First seen: {new Date(group.firstSeen).toLocaleString()}</span>
                <span>•</span>
                <span>Last seen: {new Date(group.lastSeen).toLocaleString()}</span>
                <span>•</span>
                <span>Fingerprint: {group.fingerprint}</span>
                {group.lastTraceId && (
                  <>
                    <span>•</span>
                    <button
                      onClick={() => navigate(`/admin/traces/${group.lastTraceId}`)}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Latest Trace <ExternalLink className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stack Trace */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="h-4 w-4 text-primary" /> Stack Trace
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={copyStackTrace}
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                Copy Trace
              </Button>
            </div>
            <CardContent className="p-5">
              <pre className="p-4 rounded-xl bg-muted/30 border border-border/70 font-mono text-xs text-rose-300 dark:text-rose-200 overflow-x-auto whitespace-pre leading-relaxed">
                {group.sampleStackTrace || 'No stack trace recorded.'}
              </pre>
            </CardContent>
          </Card>

          {/* Occurrences List */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary" /> Recent Occurrences ({group.occurrences.length})
              </span>
            </div>

            <div className="divide-y divide-border/40 font-mono text-xs">
              {group.occurrences.map((occ) => (
                <div key={occ.id} className="p-4 space-y-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{new Date(occ.timestamp).toLocaleString()}</span>
                      {occ.route && (
                        <Badge variant="outline" className="text-[10px]">{occ.method} {occ.route}</Badge>
                      )}
                      {occ.statusCode && (
                        <Badge className="bg-rose-500/15 text-rose-500 border-rose-500/30 text-[10px]">
                          HTTP {occ.statusCode}
                        </Badge>
                      )}
                    </div>

                    {occ.traceId && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-primary gap-1"
                        onClick={() => navigate(`/admin/traces/${occ.traceId}`)}
                      >
                        Trace {occ.traceId.slice(0, 10)}... <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  <div className="text-muted-foreground text-xs font-sans">
                    {occ.message}
                  </div>

                  {occ.userEmail && (
                    <div className="text-[11px] text-muted-foreground">
                      User: <span className="text-foreground">{occ.userEmail}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
