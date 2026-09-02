// apps/web/src/pages/admin/AlertsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AlertRuleItem, AlertIncidentItem } from '@/lib/api';
import { SeverityBadge, StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  BellRing,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRuleItem[]>([]);
  const [incidents, setIncidents] = useState<AlertIncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    metric: 'error_rate',
    condition: 'gt',
    threshold: '5',
    windowMinutes: '5',
    severity: 'WARNING',
  });

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await admin.getAlerts();
      setRules(res.rules);
      setIncidents(res.incidents);
    } catch {
      toast.error('Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await admin.createAlert({
        name: newRule.name,
        description: newRule.description,
        metric: newRule.metric,
        condition: newRule.condition,
        threshold: parseFloat(newRule.threshold),
        windowMinutes: parseInt(newRule.windowMinutes),
        severity: newRule.severity,
      });

      toast.success('Alert rule configured successfully');
      setIsCreating(false);
      setNewRule({ name: '', description: '', metric: 'error_rate', condition: 'gt', threshold: '5', windowMinutes: '5', severity: 'WARNING' });
      fetchAlerts();
    } catch {
      toast.error('Failed to create alert rule');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    try {
      await admin.deleteAlert(id);
      toast.success('Alert rule deleted');
      fetchAlerts();
    } catch {
      toast.error('Failed to delete alert rule');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BellRing className="h-6 w-6 text-primary" /> Automated Alert Rules & Incident Monitoring
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure threshold alert rules on error rates, latency spikes, and AI failures with incident history
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreating(true)}
            className="text-xs h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create Rule
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={fetchAlerts}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Create Rule Modal / Card */}
      {isCreating && (
        <Card className="border-primary/40 bg-card shadow-lg animate-in slide-in-from-top-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Configure New Alert Rule</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Rule Name</Label>
                  <Input
                    type="text"
                    placeholder="e.g. High Error Rate Threshold"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Severity</Label>
                  <select
                    value={newRule.severity}
                    onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Metric</Label>
                  <select
                    value={newRule.metric}
                    onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="error_rate">HTTP Error Rate (%)</option>
                    <option value="latency_p95">P95 Latency (ms)</option>
                    <option value="ai_fallback_rate">AI Fallback Rate</option>
                    <option value="job_failures">Job Failure Count</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Threshold Value</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={newRule.threshold}
                    onChange={(e) => setNewRule({ ...newRule, threshold: e.target.value })}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Evaluation Window</Label>
                  <select
                    value={newRule.windowMinutes}
                    onChange={(e) => setNewRule({ ...newRule, windowMinutes: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="1">1 minute</option>
                    <option value="5">5 minutes</option>
                    <option value="15">15 minutes</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={creating} className="gap-2">
                  <Save className="h-4 w-4" /> Save Alert Rule
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rules.map((rule) => (
          <Card key={rule.id} className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold truncate max-w-[180px]">{rule.name}</CardTitle>
                <SeverityBadge severity={rule.severity} />
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Metric:</span>
                <span className="font-semibold text-foreground">{rule.metric}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Threshold:</span>
                <span className="text-primary font-bold">&gt; {rule.threshold}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Window:</span>
                <span>{rule.windowMinutes} mins</span>
              </div>

              <div className="flex justify-end pt-3 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-rose-500 hover:text-rose-600 font-sans"
                  onClick={() => handleDeleteRule(rule.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Incident History Stream */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-4 border-b border-border/60 bg-muted/20">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
            Triggered Incidents History ({incidents.length})
          </span>
        </div>

        <div className="divide-y divide-border/40 font-mono text-xs">
          {incidents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No alert incidents triggered. System is within nominal limits.</div>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={inc.status} />
                    <span className="font-bold text-foreground">{inc.rule?.name || 'Alert Incident'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans">{inc.message}</p>
                </div>

                <div className="text-right text-[11px] text-muted-foreground">
                  <div>{new Date(inc.triggeredAt).toLocaleString()}</div>
                  <div className="text-primary font-semibold">Value: {inc.metricValue}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
