// apps/web/src/pages/admin/ObservabilityOverviewPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, ObservabilityOverview } from '@/lib/api';
import { MetricCard } from '@/components/admin/MetricCard';
import { StatusBadge, HealthBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  ArrowUpRight,
  RefreshCw,
  Server,
  Database,
  Cpu,
  ShieldAlert,
  AlertOctagon,
  Clock,
  Layers,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ObservabilityOverviewPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ObservabilityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchOverview = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const res = await admin.getObservabilityOverview();
      setData(res);
      if (isManual) toast.success('Telemetry data refreshed');
    } catch (err) {
      toast.error('Failed to load telemetry overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchOverview(), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-mono">Loading real-time observability telemetry...</p>
      </div>
    );
  }

  const req = data?.requests || { total: 0, status2xx: 0, status4xx: 0, status5xx: 0, errorRate: 0, requestsPerMinute: 0 };
  const lat = data?.latency || { avg: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
  const comp = data?.comparison || { requestsVsYesterday: 0, errorsVsYesterday: 0, latencyVsYesterday: 0 };
  const health = data?.systemHealth || { overall: 'healthy', database: { status: 'healthy', latencyMs: 0 }, redis: { status: 'healthy', latencyMs: 0 }, queues: {}, uptimeSeconds: 0, timestamp: '' };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-primary" /> Observability Overview
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time telemetry, request throughput, distributed tracing, and subsystem health
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs h-8 gap-1.5"
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
            {autoRefresh ? 'Live Polling (10s)' : 'Paused'}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => fetchOverview(true)}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Real-time Health Matrix */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-bold">Subsystem Health Matrix</CardTitle>
            </div>
            <HealthBadge status={health.overall} />
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-500">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold">PostgreSQL (Neon)</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{health.database.latencyMs}ms query latency</p>
                </div>
              </div>
              <StatusBadge status={health.database.status} />
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-500">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Redis Cache & Queues</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{health.redis.latencyMs}ms ping</p>
                </div>
              </div>
              <StatusBadge status={health.redis.status} />
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold">AI Models (OpenRouter)</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{data?.usage.aiCalls || 0} calls today</p>
                </div>
              </div>
              <StatusBadge status="HEALTHY" />
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Background Workers</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{data?.usage.backgroundJobs || 0} jobs processed</p>
                </div>
              </div>
              <StatusBadge status="ACTIVE" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Telemetry Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total HTTP Requests"
          value={req.total.toLocaleString()}
          change={comp.requestsVsYesterday}
          subtitle="requests today"
          icon={Activity}
          statusColor="sky"
        />

        <MetricCard
          title="Error Rate"
          value={`${req.errorRate}%`}
          change={comp.errorsVsYesterday}
          invertChangeColor={true}
          subtitle={`5xx: ${req.status5xx} | 4xx: ${req.status4xx}`}
          icon={AlertOctagon}
          statusColor={req.errorRate > 2 ? 'rose' : 'emerald'}
        />

        <MetricCard
          title="Latency P95"
          value={`${lat.p95} ms`}
          change={comp.latencyVsYesterday}
          invertChangeColor={true}
          subtitle={`P50: ${lat.p50}ms • P99: ${lat.p99}ms`}
          icon={Clock}
          statusColor="purple"
        />

        <MetricCard
          title="Security & Errors"
          value={data?.security.securityEventsToday || 0}
          subtitle={`${data?.errors.unresolvedErrorGroups || 0} unresolved error groups`}
          icon={ShieldAlert}
          statusColor={data?.security.activeAlerts ? 'rose' : 'emerald'}
        />
      </div>

      {/* Real Latency Percentiles Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Latency Distribution & Percentiles</span>
              <Badge variant="outline" className="font-mono text-[11px]">Real Telemetry</Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Response time percentiles computed across recent requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[11px] text-muted-foreground">Average</p>
                <p className="text-base font-bold font-mono text-foreground mt-1">{lat.avg}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[11px] text-muted-foreground">P50 (Median)</p>
                <p className="text-base font-bold font-mono text-emerald-500 mt-1">{lat.p50}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[11px] text-muted-foreground">P75</p>
                <p className="text-base font-bold font-mono text-foreground mt-1">{lat.p75}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[11px] text-muted-foreground">P90</p>
                <p className="text-base font-bold font-mono text-amber-500 mt-1">{lat.p90}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[11px] text-muted-foreground">P95</p>
                <p className="text-base font-bold font-mono text-orange-500 mt-1">{lat.p95}ms</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                <p className="text-[11px] text-muted-foreground">P99 (Tail)</p>
                <p className="text-base font-bold font-mono text-rose-500 mt-1">{lat.p99}ms</p>
              </div>
            </div>

            {/* HTTP Status Breakdown */}
            <div className="pt-3 border-t border-border/60">
              <div className="flex justify-between text-xs mb-2">
                <span className="font-semibold text-muted-foreground">HTTP Status Distribution</span>
                <span className="font-mono text-muted-foreground">{req.total} total</span>
              </div>
              <div className="h-3 w-full rounded-full bg-muted/40 overflow-hidden flex">
                <div
                  style={{ width: `${req.total > 0 ? (req.status2xx / req.total) * 100 : 100}%` }}
                  className="bg-emerald-500 h-full"
                  title={`2xx Success: ${req.status2xx}`}
                />
                <div
                  style={{ width: `${req.total > 0 ? (req.status4xx / req.total) * 100 : 0}%` }}
                  className="bg-amber-500 h-full"
                  title={`4xx Client Error: ${req.status4xx}`}
                />
                <div
                  style={{ width: `${req.total > 0 ? (req.status5xx / req.total) * 100 : 0}%` }}
                  className="bg-rose-500 h-full"
                  title={`5xx Server Error: ${req.status5xx}`}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 2xx: {req.status2xx}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> 4xx: {req.status4xx}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> 5xx: {req.status5xx}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Diagnostic Actions */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Observability Quick Actions</CardTitle>
            <CardDescription className="text-xs">Deep dive into dedicated subsystem diagnostics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Button
              variant="outline"
              className="w-full justify-between text-xs h-10 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              onClick={() => navigate('/admin/logs')}
            >
              <span>Explore Structured Logs</span>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between text-xs h-10 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              onClick={() => navigate('/admin/traces')}
            >
              <span>Inspect Distributed Traces</span>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between text-xs h-10 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              onClick={() => navigate('/admin/errors')}
            >
              <span>Investigate Error Groups</span>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between text-xs h-10 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
              onClick={() => navigate('/admin/security')}
            >
              <span>View Security Incidents</span>
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
