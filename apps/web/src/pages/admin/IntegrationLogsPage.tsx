// apps/web/src/pages/admin/IntegrationLogsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AuditEventItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { MetricCard } from '@/components/admin/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Puzzle,
  Github,
  Mail,
  RefreshCw,
  Clock,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export default function IntegrationLogsPage() {
  const [data, setData] = useState<{
    connectedProviders: { github: number; google: number; zoho: number };
    recentEvents: AuditEventItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await admin.getIntegrationsStats();
      setData(res);
    } catch {
      toast.error('Failed to load integrations telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Puzzle className="h-6 w-6 text-primary" /> External Integrations Observability
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            GitHub Commits/PRs sync, Google Workspace OAuth, and Zoho Mail connection telemetry & event logs
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Connected Providers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="GitHub Integrations"
          value={data?.connectedProviders.github || 0}
          subtitle="Active repo syncs"
          icon={Github}
          statusColor="sky"
        />
        <MetricCard
          title="Google Workspace"
          value={data?.connectedProviders.google || 0}
          subtitle="OAuth mail connections"
          icon={Mail}
          statusColor="emerald"
        />
        <MetricCard
          title="Zoho Mail"
          value={data?.connectedProviders.zoho || 0}
          subtitle="OAuth mail connections"
          icon={Mail}
          statusColor="amber"
        />
      </div>

      {/* Integration Events Stream */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Integration Sync & OAuth Event Trail ({data?.recentEvents.length || 0})
          </span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {!data || data.recentEvents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent integration events.</div>
          ) : (
            data.recentEvents.map((ev) => (
              <div key={ev.id} className="p-4 hover:bg-muted/40 transition-colors space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={ev.status} />
                    <span className="font-bold text-foreground">{ev.action}</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {ev.resource || 'integration'}
                    </Badge>
                  </div>

                  <span className="text-[11px] text-muted-foreground">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                </div>

                {ev.actorEmail && (
                  <div className="text-[11px] text-muted-foreground">
                    User: <span className="text-foreground">{ev.actorEmail}</span>
                  </div>
                )}

                {ev.details && Object.keys(ev.details).length > 0 && (
                  <pre className="p-3 rounded-lg bg-muted/30 text-[11px] text-foreground overflow-x-auto">
                    {JSON.stringify(ev.details, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
