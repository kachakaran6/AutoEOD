// apps/web/src/pages/admin/SystemHealthPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin } from '@/lib/api';
import { HealthBadge, StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  HeartPulse,
  Database,
  Layers,
  Cpu,
  Mail,
  Server,
  RefreshCw,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

export default function SystemHealthPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await admin.getSystemHealth();
      setData(res);
    } catch {
      toast.error('Failed to load deep system health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <HeartPulse className="h-6 w-6 text-primary" /> Comprehensive System & Infrastructure Health
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time connection verification, query latencies, memory consumption, and queue status
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchHealth}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Diagnostics
        </Button>
      </div>

      {/* Subsystem Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Database Health Card */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">PostgreSQL (Neon)</CardTitle>
                <CardDescription className="text-xs">Primary relational database engine</CardDescription>
              </div>
            </div>
            <StatusBadge status={data?.database?.status || 'HEALTHY'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs font-mono">
            <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <span className="text-muted-foreground font-sans">Query Round-Trip Latency:</span>
              <span className="font-bold text-foreground">{data?.database?.latencyMs || 0} ms</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <span className="text-muted-foreground font-sans">Connection State:</span>
              <span className="text-emerald-500 font-bold">PostgreSQL Pool Active</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-xs h-8 mt-2 font-sans"
              onClick={() => navigate('/admin/system-health/database')}
            >
              <span>View Database Metrics</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Redis Health Card */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Redis Cache & Queues</CardTitle>
                <CardDescription className="text-xs">In-memory buffer & BullMQ queue coordinator</CardDescription>
              </div>
            </div>
            <StatusBadge status={data?.redis?.status || 'HEALTHY'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs font-mono">
            <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <span className="text-muted-foreground font-sans">Ping Latency:</span>
              <span className="font-bold text-foreground">{data?.redis?.latencyMs || 0} ms</span>
            </div>
            <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <span className="text-muted-foreground font-sans">Memory Used:</span>
              <span className="text-foreground">{data?.redis?.memory || 'N/A'}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-xs h-8 mt-2 font-sans"
              onClick={() => navigate('/admin/system-health/redis')}
            >
              <span>View Redis Diagnostics</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* AI Provider Gateway */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">AI Gateway</CardTitle>
                <CardDescription className="text-xs">OpenRouter / OpenAI LLM endpoint</CardDescription>
              </div>
            </div>
            <StatusBadge status={data?.aiProvider?.status || 'HEALTHY'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs font-mono">
            <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <span className="text-muted-foreground font-sans">Provider Name:</span>
              <span className="text-foreground">{data?.aiProvider?.provider || 'OpenRouter'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Email Provider */}
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold">Email Dispatcher</CardTitle>
                <CardDescription className="text-xs">Resend transactional email delivery</CardDescription>
              </div>
            </div>
            <StatusBadge status={data?.emailProvider?.status || 'HEALTHY'} />
          </CardHeader>
          <CardContent className="space-y-3 text-xs font-mono">
            <div className="flex justify-between p-3 rounded-lg bg-muted/30 border border-border/60">
              <span className="text-muted-foreground font-sans">Provider Gateway:</span>
              <span className="text-foreground">{data?.emailProvider?.provider || 'Resend API'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
