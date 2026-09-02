// apps/web/src/pages/admin/LogSettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, ObservabilitySettings } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Settings2,
  RefreshCw,
  Save,
  ShieldCheck,
  Cpu,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LogSettingsPage() {
  const [settings, setSettings] = useState<ObservabilitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await admin.getLogSettings();
      setSettings(data);
    } catch {
      toast.error('Failed to load observability settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await admin.updateLogSettings(settings);
      setSettings(updated);
      toast.success('Live observability settings updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Settings2 className="h-6 w-6 text-primary" /> Observability & Privacy Governance
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure live log verbosity, trace sampling rates, sensitive data redaction, and LLM prompt privacy policies
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchSettings}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading && !settings ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Loading telemetry settings...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Log Engine Verbosity & Sampling</CardTitle>
              <CardDescription className="text-xs">Control runtime logging thresholds and distributed tracing collection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Active Log Level</Label>
                <select
                  value={settings?.logLevel || 'info'}
                  onChange={(e) => setSettings({ ...settings!, logLevel: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="trace">TRACE (Deepest diagnostic logging)</option>
                  <option value="debug">DEBUG (Verbose development diagnostics)</option>
                  <option value="info">INFO (Standard production logging - Recommended)</option>
                  <option value="warn">WARN (Warnings and operational deviations only)</option>
                  <option value="error">ERROR (Errors and exceptions only)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Distributed Trace Sampling Rate ({settings?.samplingRatePercent || 100}%)</Label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={settings?.samplingRatePercent || 100}
                  onChange={(e) => setSettings({ ...settings!, samplingRatePercent: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Security, Redaction & Privacy</CardTitle>
              <CardDescription className="text-xs">Automated token masking and LLM prompt privacy protection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/70">
                <div>
                  <p className="text-xs font-semibold text-foreground">Sensitive Data Redaction</p>
                  <p className="text-[11px] text-muted-foreground">Automatically redact passwords, tokens, API keys, and Authorization headers</p>
                </div>
                <Switch
                  checked={settings?.redactionEnabled ?? true}
                  onCheckedChange={(checked) => setSettings({ ...settings!, redactionEnabled: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">AI Prompt Privacy Policy</Label>
                <select
                  value={settings?.aiPromptPrivacy || 'metadata_only'}
                  onChange={(e) => setSettings({ ...settings!, aiPromptPrivacy: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border bg-card text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="metadata_only">Metadata Only (Tokens, Model & Cost, No raw prompt text)</option>
                  <option value="full_sanitized">Sanitized Text (Prompt recorded with sensitive keys masked)</option>
                  <option value="disabled">Disabled (Do not log AI execution metadata)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={fetchSettings} disabled={saving}>
              Reset
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
