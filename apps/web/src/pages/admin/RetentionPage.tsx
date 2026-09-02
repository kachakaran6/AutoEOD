// apps/web/src/pages/admin/RetentionPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, RetentionPolicyItem } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileArchive,
  RefreshCw,
  Trash2,
  Save,
  CheckCircle2,
  HardDrive,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

export default function RetentionPage() {
  const [policies, setPolicies] = useState<RetentionPolicyItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const fetchRetention = async () => {
    setLoading(true);
    try {
      const res = await admin.getRetention();
      setPolicies(res.policies);
      setStats(res.storageStats);
    } catch {
      toast.error('Failed to load retention policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRetention();
  }, []);

  const handleUpdate = async (category: string, retentionDays: number) => {
    try {
      await admin.updateRetention(category, { retentionDays });
      toast.success(`Retention policy for ${category} updated to ${retentionDays} days`);
      fetchRetention();
    } catch {
      toast.error('Failed to update retention policy');
    }
  };

  const handleRunCleanup = async () => {
    if (!confirm('Run automated retention cleanup now? Records past policy windows will be pruned.')) return;
    setCleaning(true);
    try {
      const res = await admin.runRetentionCleanup();
      toast.success(`Cleanup complete: ${res.result.deletedErrors} errors, ${res.result.deletedSecurity} security events, ${res.result.deletedAudits} audit records pruned`);
      fetchRetention();
    } catch {
      toast.error('Failed to execute retention cleanup');
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileArchive className="h-6 w-6 text-primary" /> Data Retention & Automated Storage Lifecycle
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure data retention windows per log category to prevent unbounded PostgreSQL storage growth
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunCleanup}
            disabled={cleaning}
            className="text-xs h-8 gap-1.5 text-rose-500 hover:text-rose-600"
          >
            <Trash2 className={`h-3.5 w-3.5 ${cleaning ? 'animate-spin' : ''}`} /> Run Cleanup Now
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={fetchRetention}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Storage Volume Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Stored Audit Events</p>
          <p className="text-2xl font-bold font-mono text-foreground mt-2">{(stats?.auditEvents || 0).toLocaleString()}</p>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Security Incident Events</p>
          <p className="text-2xl font-bold font-mono text-foreground mt-2">{(stats?.securityEvents || 0).toLocaleString()}</p>
        </Card>
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase">Error Occurrences</p>
          <p className="text-2xl font-bold font-mono text-foreground mt-2">{(stats?.errorOccurrences || 0).toLocaleString()}</p>
        </Card>
      </div>

      {/* Policies Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Active Retention Windows
          </span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {policies.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap hover:bg-muted/30">
              <div className="space-y-1">
                <span className="font-bold text-foreground font-mono uppercase text-xs">{p.logCategory}</span>
                <p className="text-[11px] text-muted-foreground font-sans">
                  Records older than {p.retentionDays} days are pruned automatically
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="1"
                    max="1825"
                    defaultValue={p.retentionDays}
                    id={`days-${p.logCategory}`}
                    className="w-20 h-8 text-xs font-mono text-right"
                  />
                  <span className="text-muted-foreground text-xs font-sans">days</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 font-sans"
                  onClick={() => {
                    const el = document.getElementById(`days-${p.logCategory}`) as HTMLInputElement;
                    if (el) handleUpdate(p.logCategory, parseInt(el.value));
                  }}
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
