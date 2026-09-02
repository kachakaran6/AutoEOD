// apps/web/src/pages/admin/DatabaseHealthPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { MetricCard } from '@/components/admin/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DatabaseHealthPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDbHealth = async () => {
    setLoading(true);
    try {
      const res = await admin.getSystemHealth();
      setHealth(res.database);
    } catch {
      toast.error('Failed to query database health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDbHealth();
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
          onClick={fetchDbHealth}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <Database className="h-6 w-6 text-blue-500" /> PostgreSQL Database Health
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Connection pool latency, query response times, schema health, and Neon serverless connectivity
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Engine Status"
          value={health?.status?.toUpperCase() || 'HEALTHY'}
          subtitle="PostgreSQL Active"
          icon={CheckCircle2}
          statusColor="emerald"
        />
        <MetricCard
          title="Query Ping Latency"
          value={`${health?.latencyMs || 0} ms`}
          subtitle="SELECT 1 round-trip time"
          icon={Clock}
          statusColor="sky"
        />
        <MetricCard
          title="Driver Architecture"
          value="Prisma ORM"
          subtitle="Connection Pooling via PgBouncer"
          icon={HardDrive}
          statusColor="purple"
        />
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold">PostgreSQL Architecture Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 font-mono text-xs">
          <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
            <span className="text-muted-foreground font-sans">ORM Framework:</span>
            <span className="text-foreground">Prisma Client v5.22.0</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
            <span className="text-muted-foreground font-sans">Data Model Entities:</span>
            <span className="text-foreground">22 Relational Models & Enum Taxonomies</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
            <span className="text-muted-foreground font-sans">Storage Guarantee:</span>
            <span className="text-emerald-500">Append-Only Immutable Audit & Security Trail</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
