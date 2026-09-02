// apps/web/src/pages/admin/AdminAnalyticsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AdminAnalytics } from '@/lib/api';
import { MetricCard } from '@/components/admin/MetricCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  RefreshCw,
  Users,
  FileText,
  Activity,
  Globe,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await admin.getAnalytics();
      setAnalytics(res);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const m = analytics?.metrics || {
    totalUsers: 0,
    totalReports: 0,
    totalActivityEvents: 0,
    totalBrowserLogs: 0,
    estimatedApiReqs: 0,
    avgResponseMs: 0,
    statusDistribution: { '2xx_success': 100, '4xx_client': 0, '5xx_server': 0 },
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-primary" /> Platform Analytics & Telemetry Trends
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Historical activity volume, report generation consumption, and request distribution analytics
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchAnalytics}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Registered Users"
          value={m.totalUsers}
          subtitle="Active accounts"
          icon={Users}
          statusColor="sky"
        />
        <MetricCard
          title="Total Reports Generated"
          value={m.totalReports}
          subtitle="EOD report summaries"
          icon={FileText}
          statusColor="purple"
        />
        <MetricCard
          title="Activity Timeline Events"
          value={m.totalActivityEvents.toLocaleString()}
          subtitle="Captured git commits & PRs"
          icon={Activity}
          statusColor="emerald"
        />
        <MetricCard
          title="Browser Log Heartbeats"
          value={m.totalBrowserLogs.toLocaleString()}
          subtitle="Chrome extension events"
          icon={Globe}
          statusColor="amber"
        />
      </div>

      {/* Status Distribution Breakdown */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold">API Traffic Distribution & Quality</CardTitle>
          <CardDescription className="text-xs">Overall response health across all endpoints</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-xs font-sans text-muted-foreground">Successful (2xx)</span>
              <p className="text-xl font-bold text-emerald-500 mt-1">{m.statusDistribution['2xx_success']}%</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-xs font-sans text-muted-foreground">Client Errors (4xx)</span>
              <p className="text-xl font-bold text-amber-500 mt-1">{m.statusDistribution['4xx_client']}%</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <span className="text-xs font-sans text-muted-foreground">Server Errors (5xx)</span>
              <p className="text-xl font-bold text-rose-500 mt-1">{m.statusDistribution['5xx_server']}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
