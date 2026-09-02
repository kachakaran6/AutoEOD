// apps/web/src/pages/admin/PerformanceMetricsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, PerformanceMetricsResponse, EndpointMetricItem } from '@/lib/api';
import { MetricCard } from '@/components/admin/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Search,
  RefreshCw,
  Clock,
  Zap,
  Activity,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PerformanceMetricsPage() {
  const [data, setData] = useState<PerformanceMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'avg' | 'p95' | 'errorRate'>('count');

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await admin.getMetrics();
      setData(res);
    } catch {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const endpoints = (data?.endpoints || []).filter((ep) =>
    ep.route.toLowerCase().includes(search.toLowerCase()) || ep.method.toLowerCase().includes(search.toLowerCase())
  );

  endpoints.sort((a, b) => {
    if (sortBy === 'count') return b.count - a.count;
    if (sortBy === 'avg') return b.avgDurationMs - a.avgDurationMs;
    if (sortBy === 'p95') return b.p95DurationMs - a.p95DurationMs;
    if (sortBy === 'errorRate') return b.errorRate - a.errorRate;
    return 0;
  });

  const req = data?.requests || { total: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0, errorRate: 0 };
  const lat = data?.latency || { avg: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-primary" /> Performance & Endpoint Telemetry
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real P50/P75/P90/P95/P99 latency percentiles, endpoint throughput, and error rates from live traffic
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchMetrics}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Latency Percentiles Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Average Latency"
          value={`${lat.avg} ms`}
          subtitle="Mean response time"
          icon={Clock}
          statusColor="sky"
        />
        <MetricCard
          title="P50 (Median)"
          value={`${lat.p50} ms`}
          subtitle="50% of requests faster than"
          icon={Zap}
          statusColor="emerald"
        />
        <MetricCard
          title="P95 Latency"
          value={`${lat.p95} ms`}
          subtitle="95% of requests faster than"
          icon={Activity}
          statusColor="amber"
        />
        <MetricCard
          title="P99 (Tail Latency)"
          value={`${lat.p99} ms`}
          subtitle="Worst 1% of requests"
          icon={BarChart3}
          statusColor="rose"
        />
      </div>

      {/* Endpoints Table Card */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Endpoint Telemetry Breakdown ({endpoints.length})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter route..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs font-mono bg-card"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none"
            >
              <option value="count">Sort: Total Calls</option>
              <option value="avg">Sort: Avg Latency</option>
              <option value="p95">Sort: P95 Latency</option>
              <option value="errorRate">Sort: Error Rate</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left divide-y divide-border/60">
            <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Route & Method</th>
                <th className="px-4 py-3 text-right">Calls</th>
                <th className="px-4 py-3 text-right">Error Rate</th>
                <th className="px-4 py-3 text-right">Avg (ms)</th>
                <th className="px-4 py-3 text-right">P50 (ms)</th>
                <th className="px-4 py-3 text-right">P95 (ms)</th>
                <th className="px-4 py-3 text-right">P99 (ms)</th>
                <th className="px-4 py-3 text-right">Last Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading performance metrics...
                  </td>
                </tr>
              ) : endpoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No endpoint telemetry recorded yet.
                  </td>
                </tr>
              ) : (
                endpoints.map((ep) => (
                  <tr key={`${ep.method}-${ep.route}`} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-semibold">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 font-bold',
                            ep.method === 'GET' && 'text-sky-500 border-sky-500/30',
                            ep.method === 'POST' && 'text-emerald-500 border-emerald-500/30',
                            ep.method === 'PATCH' && 'text-amber-500 border-amber-500/30',
                            ep.method === 'DELETE' && 'text-rose-500 border-rose-500/30'
                          )}
                        >
                          {ep.method}
                        </Badge>
                        <span className="text-foreground">{ep.route}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{ep.count}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={ep.errorRate > 0 ? 'text-rose-500 font-bold' : 'text-emerald-500'}>
                        {ep.errorRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{ep.avgDurationMs}ms</td>
                    <td className="px-4 py-3 text-right text-emerald-500 font-medium">{ep.p50DurationMs}ms</td>
                    <td className="px-4 py-3 text-right text-amber-500 font-medium">{ep.p95DurationMs}ms</td>
                    <td className="px-4 py-3 text-right text-rose-500 font-medium">{ep.p99DurationMs}ms</td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-[11px]">
                      {new Date(ep.lastAccessedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
