// apps/web/src/pages/admin/AiObservabilityPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AdminModelsUsage } from '@/lib/api';
import { MetricCard } from '@/components/admin/MetricCard';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Cpu,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AiObservabilityPage() {
  const [data, setData] = useState<AdminModelsUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAiData = async () => {
    setLoading(true);
    try {
      const res = await admin.getAiObservability();
      setData(res);
    } catch {
      toast.error('Failed to load AI observability data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAiData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Cpu className="h-6 w-6 text-primary" /> AI Models & LLM Observability
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            LLM request lifecycle, prompt token metrics, fallback switchovers, and model execution telemetry
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchAiData}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Reports Generated"
          value={data?.metrics.totalReports || 0}
          subtitle="AI summary generations"
          icon={Sparkles}
          statusColor="purple"
        />
        <MetricCard
          title="AI Success Rate"
          value={`${data?.metrics.successRate || 100}%`}
          subtitle={`${data?.metrics.successfulReports || 0} successful / ${data?.metrics.failedReports || 0} failed`}
          icon={CheckCircle2}
          statusColor="emerald"
        />
        <MetricCard
          title="Timeline AI Summaries"
          value={data?.metrics.totalTimelineSummaries || 0}
          subtitle="Real-time minute analyses"
          icon={Zap}
          statusColor="sky"
        />
        <MetricCard
          title="Estimated Tokens"
          value={(data?.metrics.estimatedTokensUsed || 0).toLocaleString()}
          subtitle="Across all LLM requests"
          icon={Cpu}
          statusColor="amber"
        />
      </div>

      {/* Model Configuration & Provider Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Active LLM Provider Configuration</CardTitle>
            <CardDescription className="text-xs">Primary models and automatic fallback routing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/70 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Provider Gateway:</span>
                <Badge variant="outline">{data?.config.providerName || 'OpenRouter / OpenAI'}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Primary Model:</span>
                <span className="font-bold text-primary">{data?.config.primaryModel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Fallback Model:</span>
                <span className="font-bold text-amber-500">{data?.config.fallbackModel}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-sans">Gateway URL:</span>
                <span className="text-muted-foreground text-[11px] truncate max-w-[260px]">{data?.config.baseURL}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Model Breakdown Chart */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Model Usage Distribution</CardTitle>
            <CardDescription className="text-xs">Volume distribution between primary and fallback models</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.modelBreakdown.map((m) => (
              <div key={m.model} className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span className="font-semibold text-foreground">{m.model}</span>
                  <span>{m.count} reports ({m.percentage}%)</span>
                </div>
                <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${m.percentage}%` }}
                    className="h-full bg-primary rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* AI Execution Logs */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Recent AI Generation Logs ({data?.recentAiLogs?.length || 0})
          </span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs max-h-[400px] overflow-y-auto">
          {!data || !data.recentAiLogs || data.recentAiLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent AI logs recorded.</div>
          ) : (
            data.recentAiLogs.map((log: any, i: number) => (
              <div key={log.id || i} className="p-3.5 hover:bg-muted/30 transition-colors space-y-1">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">{new Date(log.timestamp || Date.now()).toLocaleTimeString()}</span>
                  {log.durationMs !== undefined && <span className="text-emerald-500">{log.durationMs}ms</span>}
                </div>
                <p className="text-xs text-foreground font-sans">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
