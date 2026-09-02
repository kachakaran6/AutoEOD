// apps/web/src/pages/admin/RemoteConfigPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, AdminSystemConfig } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Sliders,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';

export default function RemoteConfigPage() {
  const [config, setConfig] = useState<AdminSystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await admin.getConfig();
      setConfig(data);
    } catch {
      toast.error('Failed to load system configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const updated = await admin.updateConfig(config);
      setConfig(updated);
      toast.success('Remote configuration saved and broadcasted to clients');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update config');
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
            <Sliders className="h-6 w-6 text-primary" /> Remote Client & System Configuration
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Dynamic remote configuration broadcast to Chrome Extensions, Web App, and Mobile/Desktop clients
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchConfig}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {loading && !config ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Loading remote configuration...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">API & Endpoint Gateways</CardTitle>
              <CardDescription className="text-xs">Base URLs resolved by clients during initialization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Backend API Base URL</Label>
                <Input
                  type="url"
                  value={config?.apiBaseUrl || ''}
                  onChange={(e) => setConfig({ ...config!, apiBaseUrl: e.target.value })}
                  placeholder="https://autoeod-be.kachakaran.tech"
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Frontend Web Base URL</Label>
                <Input
                  type="url"
                  value={config?.webBaseUrl || ''}
                  onChange={(e) => setConfig({ ...config!, webBaseUrl: e.target.value })}
                  placeholder="https://autoeod.kachakaran.tech"
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Client Versioning & Maintenance Control</CardTitle>
              <CardDescription className="text-xs">Enforce minimum supported client versions and maintenance gates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Minimum Extension Version</Label>
                  <Input
                    type="text"
                    value={config?.minExtensionVersion || ''}
                    onChange={(e) => setConfig({ ...config!, minExtensionVersion: e.target.value })}
                    placeholder="1.0.0"
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Minimum Desktop Version</Label>
                  <Input
                    type="text"
                    value={config?.minDesktopVersion || ''}
                    onChange={(e) => setConfig({ ...config!, minDesktopVersion: e.target.value })}
                    placeholder="1.0.0"
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 space-y-4">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/70">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Maintenance Mode</p>
                    <p className="text-[11px] text-muted-foreground">Temporarily prevent user access for system upgrades</p>
                  </div>
                  <Switch
                    checked={config?.maintenanceMode || false}
                    onCheckedChange={(checked) => setConfig({ ...config!, maintenanceMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/30 border border-border/70">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Force Client Updates</p>
                    <p className="text-[11px] text-muted-foreground">Prompt clients below minimum version to upgrade immediately</p>
                  </div>
                  <Switch
                    checked={config?.forceUpdate || false}
                    onCheckedChange={(checked) => setConfig({ ...config!, forceUpdate: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={fetchConfig} disabled={saving}>
              Reset Changes
            </Button>
            <Button type="submit" size="sm" disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
