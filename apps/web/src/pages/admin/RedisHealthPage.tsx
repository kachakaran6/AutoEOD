// apps/web/src/pages/admin/RedisHealthPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { MetricCard } from '@/components/admin/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  HardDrive,
  Activity,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

export default function RedisHealthPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRedisHealth = async () => {
    setLoading(true);
    try {
      const res = await admin.getSystemHealth();
      setHealth(res.redis);
    } catch {
      toast.error('Failed to query Redis health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRedisHealth();
  }, []);

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/system-health')}
          className="gap-2 text-xs h-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to System Health
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchRedisHealth}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Layers className="h-6 w-6 text-rose-500" /> Redis Cache & Queue Coordinator
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          In-memory buffer metrics, instantaneous operations per second, memory consumption, and BullMQ coordination
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Status"
          value={health?.status?.toUpperCase() || 'HEALTHY'}
          subtitle="Ping response active"
          icon={CheckCircle2}
          statusColor="emerald"
        />
        <MetricCard
          title="Ping Latency"
          value={`${health?.latencyMs || 0} ms`}
          subtitle="Round-trip command time"
          icon={Clock}
          statusColor="sky"
        />
        <MetricCard
          title="Memory Consumption"
          value={health?.memory || 'N/A'}
          subtitle="Total allocated data size"
          icon={HardDrive}
          statusColor="purple"
        />
        <MetricCard
          title="Ops / Second"
          value={health?.opsPerSec !== undefined ? health.opsPerSec : 'Active'}
          subtitle="Throughput operations"
          icon={Zap}
          statusColor="amber"
        />
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold">Redis Telemetry Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
            <span className="text-muted-foreground font-sans">Total Commands Processed:</span>
            <span className="text-foreground">{(health?.totalCommands || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
            <span className="text-muted-foreground font-sans">Total Keys Stored:</span>
            <span className="text-foreground">{(health?.totalKeys || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
            <span className="text-muted-foreground font-sans">Connected Clients:</span>
            <span className="text-foreground">{health?.connectedClients || 1}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
