import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  admin,
  AdminSystemConfig,
  AdminUser,
  AdminHealth,
  EmailTemplate,
  AuditLogItem,
  AdminAnalytics,
} from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  Server,
  Users,
  Sliders,
  Activity,
  Database,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Globe,
  Lock,
  Mail,
  ScrollText,
  BarChart3,
  Plus,
  Trash2,
  Edit,
  Save,
  Check,
  X,
  Search,
  Package,
  Download,
} from 'lucide-react';

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as any) || 'config';

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // State
  const [config, setConfig] = useState<AdminSystemConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    key: '',
    name: '',
    subject: '',
    bodyHtml: '',
    variables: '["userName", "reportDate"]',
    enabled: true,
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Extension Release State
  const [githubToken, setGithubToken] = useState('');
  const [releaseTag, setReleaseTag] = useState(`v1.0.${Math.floor(Date.now() / 1000)}`);
  const [releasingExtension, setReleasingExtension] = useState(false);
  const [lastRelease, setLastRelease] = useState<any | null>(null);

  // Data Fetchers
  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const data = await admin.getConfig();
      setConfig(data);
    } catch (err: any) {
      toast.error('Failed to load config: ' + (err.message || 'Error'));
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await admin.getUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error('Failed to load users: ' + (err.message || 'Error'));
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await admin.getHealth();
      setHealth(data);
    } catch (err: any) {
      toast.error('Failed to load health: ' + (err.message || 'Error'));
    } finally {
      setLoadingHealth(false);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const data = await admin.getAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      toast.error('Failed to load analytics: ' + (err.message || 'Error'));
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const data = await admin.getTemplates();
      setTemplates(data);
    } catch (err: any) {
      toast.error('Failed to load templates: ' + (err.message || 'Error'));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const data = await admin.getAuditLogs();
      setAuditLogs(data);
    } catch (err: any) {
      toast.error('Failed to load audit logs: ' + (err.message || 'Error'));
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'config') loadConfig();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'health') loadHealth();
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'templates') loadTemplates();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  // Save Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSavingConfig(true);
    try {
      const updated = await admin.updateConfig({
        apiBaseUrl: config.apiBaseUrl,
        webBaseUrl: config.webBaseUrl,
        maintenanceMode: config.maintenanceMode,
        forceUpdate: config.forceUpdate,
        minExtensionVersion: config.minExtensionVersion,
        minDesktopVersion: config.minDesktopVersion,
      });
      setConfig(updated);
      toast.success('System configuration updated');
    } catch (err: any) {
      toast.error('Failed to update config: ' + (err.message || 'Error'));
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Role
  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      const updatedUser = await admin.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updatedUser.role } : u))
      );
      toast.success(`Updated role to ${newRole}`);
    } catch (err: any) {
      toast.error('Failed to update role: ' + (err.message || 'Error'));
    }
  };

  // Template Actions
  const handleSaveTemplate = async (template: EmailTemplate) => {
    try {
      const updated = await admin.updateTemplate(template.id, template);
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
      setEditingTemplate(null);
      toast.success('Email template updated');
    } catch (err: any) {
      toast.error('Failed to save template: ' + (err.message || 'Error'));
    }
  };

  const handleToggleTemplate = async (template: EmailTemplate) => {
    try {
      const updated = await admin.updateTemplate(template.id, { enabled: !template.enabled });
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
      toast.success(`Template ${!template.enabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error('Failed to toggle template: ' + (err.message || 'Error'));
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await admin.createTemplate(newTemplate);
      setTemplates((prev) => [...prev, created]);
      setIsCreatingTemplate(false);
      setNewTemplate({
        key: '',
        name: '',
        subject: '',
        bodyHtml: '',
        variables: '["userName", "reportDate"]',
        enabled: true,
      });
      toast.success('New template created');
    } catch (err: any) {
      toast.error('Failed to create template: ' + (err.message || 'Error'));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email template?')) return;
    try {
      await admin.deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success('Template deleted');
    } catch (err: any) {
      toast.error('Failed to delete template: ' + (err.message || 'Error'));
    }
  };

  const handleReleaseExtension = async () => {
    setReleasingExtension(true);
    try {
      const res = await admin.releaseExtension({
        githubToken: githubToken || undefined,
        tag: releaseTag,
        apiBaseUrl: config?.apiBaseUrl,
      });
      setLastRelease(res);
      toast.success(`Extension release ${res.tag} created successfully!`);
    } catch (err: any) {
      toast.error('Failed to create extension release: ' + (err.message || 'Error'));
    } finally {
      setReleasingExtension(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-primary" />
            Administration & Central Control
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage live system URLs, user roles, email templates, API metrics, and Pino audit logs.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
          <Button
            variant={activeTab === 'config' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('config')}
            className="text-xs gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5" /> Config
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('users')}
            className="text-xs gap-1.5"
          >
            <Users className="w-3.5 h-3.5" /> Users
          </Button>
          <Button
            variant={activeTab === 'health' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('health')}
            className="text-xs gap-1.5"
          >
            <Server className="w-3.5 h-3.5" /> Health
          </Button>
          <Button
            variant={activeTab === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('analytics')}
            className="text-xs gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Analytics
          </Button>
          <Button
            variant={activeTab === 'templates' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('templates')}
            className="text-xs gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> Templates
          </Button>
          <Button
            variant={activeTab === 'audit' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('audit')}
            className="text-xs gap-1.5"
          >
            <ScrollText className="w-3.5 h-3.5" /> Audit Logs
          </Button>
        </div>
      </div>

      {/* ── TAB 1: REMOTE CONFIG MANAGER ──────────────────────────────────────── */}
      {activeTab === 'config' && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Dynamic Remote Configuration
              </CardTitle>
              <CardDescription className="text-xs">
                Client applications (Desktop & Chrome Extension) fetch these endpoints dynamically on launch.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadConfig}
              disabled={loadingConfig}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loadingConfig ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>

          <CardContent className="pt-6">
            {loadingConfig ? (
              <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                Loading configuration...
              </div>
            ) : config ? (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Backend API Base URL
                    </label>
                    <Input
                      type="url"
                      required
                      value={config.apiBaseUrl}
                      onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
                      placeholder="https://autoeod.onrender.com"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Primary API endpoint used by Desktop Agent & Extension.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Frontend Web App URL
                    </label>
                    <Input
                      type="url"
                      required
                      value={config.webBaseUrl}
                      onChange={(e) => setConfig({ ...config, webBaseUrl: e.target.value })}
                      placeholder="https://website-0z9k.onrender.com"
                    />
                    <p className="text-[11px] text-muted-foreground">Public Web Dashboard URL.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Min Extension Version
                    </label>
                    <Input
                      type="text"
                      value={config.minExtensionVersion}
                      onChange={(e) => setConfig({ ...config, minExtensionVersion: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                      Min Desktop Version
                    </label>
                    <Input
                      type="text"
                      value={config.minDesktopVersion}
                      onChange={(e) => setConfig({ ...config, minDesktopVersion: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                  <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-500" /> Maintenance Mode
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Informs clients that maintenance is underway.
                      </p>
                    </div>
                    <Switch
                      checked={config.maintenanceMode}
                      onCheckedChange={(checked) => setConfig({ ...config, maintenanceMode: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-foreground flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500" /> Force Update Required
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Prompts clients to download mandatory updates.
                      </p>
                    </div>
                    <Switch
                      checked={config.forceUpdate}
                      onCheckedChange={(checked) => setConfig({ ...config, forceUpdate: checked })}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button type="submit" disabled={savingConfig} className="gap-2">
                    {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Configuration
                  </Button>
                </div>

                {/* 📦 1-Click Chrome Extension GitHub Release Builder */}
                <div className="pt-6 border-t border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" /> 1-Click Extension GitHub Release Builder
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Builds, zips, and automatically publishes a new Chrome Extension bundle to GitHub Releases.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      type="password"
                      placeholder="GitHub Token (Optional - overrides server env)"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      type="text"
                      placeholder="Release Version Tag (e.g. v1.0.3)"
                      value={releaseTag}
                      onChange={(e) => setReleaseTag(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleReleaseExtension}
                      disabled={releasingExtension}
                      className="gap-2 text-xs"
                    >
                      {releasingExtension ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5 text-primary" />}
                      Package & Publish Extension Release
                    </Button>

                    <a
                      href={`${config.apiBaseUrl || 'https://autoeod.onrender.com'}/api/admin/download-extension`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg border border-border transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-primary" /> Direct Download Extension .ZIP
                    </a>
                  </div>

                  {lastRelease && (
                    <div className="p-3.5 bg-muted/40 border border-border rounded-xl text-xs space-y-1.5">
                      <p className="font-semibold text-emerald-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Extension Package ({lastRelease.tag}) Created Successfully!
                      </p>
                      {lastRelease.releaseUrl && (
                        <p className="text-muted-foreground">
                          GitHub Release: <a href={lastRelease.releaseUrl} target="_blank" rel="noreferrer" className="text-primary underline font-medium">{lastRelease.releaseUrl}</a>
                        </p>
                      )}
                      {lastRelease.downloadUrl && (
                        <p className="text-muted-foreground">
                          Asset Download: <a href={lastRelease.downloadUrl} target="_blank" rel="noreferrer" className="text-primary underline font-medium">{lastRelease.downloadUrl}</a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </form>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 2: USER MANAGEMENT ────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> User Accounts & RBAC Permissions
              </CardTitle>
              <CardDescription className="text-xs">
                Manage registered users and assign Administrator permissions.
              </CardDescription>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 text-xs w-64"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={loadUsers} disabled={loadingUsers}>
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {loadingUsers ? (
              <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                Loading users...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Joined Date</th>
                      <th className="py-3 px-4">Reports</th>
                      <th className="py-3 px-4">Events</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-semibold text-foreground">{u.name}</span>
                            <p className="text-[11px] text-muted-foreground">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{u._count.reports}</td>
                        <td className="py-3 px-4 text-muted-foreground">{u._count.activityEvents}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleRole(u.id, u.role)}
                            className="text-xs"
                          >
                            {u.role === 'ADMIN' ? 'Revoke Admin' : 'Make Admin'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 3: SYSTEM HEALTH & QUEUE MONITORING ────────────────────────────── */}
      {activeTab === 'health' && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" /> Infrastructure & Worker Queue Health
              </CardTitle>
              <CardDescription className="text-xs">
                Live diagnostics for Neon PostgreSQL, Upstash Redis, and BullMQ background queues.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadHealth} disabled={loadingHealth}>
              <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {loadingHealth ? (
              <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                Pinging database & queue metrics...
              </div>
            ) : health ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Database Card */}
                  <div className="bg-muted/30 border border-border p-5 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-500" /> Neon PostgreSQL Database
                      </span>
                      {health.database.status === 'healthy' ? (
                        <Badge className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border-emerald-500/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" /> {health.database.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-foreground">
                      {health.database.latencyMs !== undefined ? `${health.database.latencyMs} ms` : 'N/A'}
                      <span className="text-xs font-normal text-muted-foreground ml-2">Latency</span>
                    </div>
                  </div>

                  {/* Redis Card */}
                  <div className="bg-muted/30 border border-border p-5 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Radio className="w-4 h-4 text-rose-500" /> Upstash Redis Infrastructure
                      </span>
                      {health.redis.status === 'healthy' ? (
                        <Badge className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border-emerald-500/30 gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" /> {health.redis.status}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-foreground">
                          {health.redis.latencyMs !== undefined ? `${health.redis.latencyMs} ms` : 'N/A'}
                        </div>
                        <p className="text-[11px] text-muted-foreground">TLS Latency</p>
                      </div>

                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {health.redis.totalCommands !== undefined ? health.redis.totalCommands.toLocaleString() : 'N/A'}
                        </div>
                        <p className="text-[11px] text-muted-foreground">Total Processed Commands</p>
                      </div>
                    </div>

                    {health.redis.totalReads !== undefined && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                        <div>Reads: <span className="text-emerald-500 font-semibold">{health.redis.totalReads?.toLocaleString()}</span></div>
                        <div>Writes: <span className="text-amber-500 font-semibold">{health.redis.totalWrites?.toLocaleString()}</span></div>
                        <div>Keys: <span className="text-primary font-semibold">{health.redis.totalKeys}</span> ({health.redis.dataSize})</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    BullMQ Queue Job Stats
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(health.queues).map(([name, counts]) => (
                      <div key={name} className="bg-muted/30 border border-border p-4 rounded-xl space-y-2">
                        <div className="text-xs font-semibold text-foreground truncate">{name}</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div>Waiting: <span className="text-amber-500 font-semibold">{counts.waiting}</span></div>
                          <div>Active: <span className="text-primary font-semibold">{counts.active}</span></div>
                          <div>Completed: <span className="text-emerald-500 font-semibold">{counts.completed}</span></div>
                          <div>Failed: <span className="text-rose-500 font-semibold">{counts.failed}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 4: API ANALYTICS ──────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> API Request Analytics & Response Times
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time API traffic volume, status code distributions, and average latency.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadAnalytics} disabled={loadingAnalytics}>
              <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {loadingAnalytics ? (
              <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                Calculating API analytics...
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-muted/30 border border-border p-4 rounded-xl">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Total Users</p>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      {analytics.metrics.totalUsers}
                    </div>
                  </div>

                  <div className="bg-muted/30 border border-border p-4 rounded-xl">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Total Reports Generated</p>
                    <div className="text-2xl font-bold text-primary mt-1">
                      {analytics.metrics.totalReports}
                    </div>
                  </div>

                  <div className="bg-muted/30 border border-border p-4 rounded-xl">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Activity Events Logged</p>
                    <div className="text-2xl font-bold text-emerald-500 mt-1">
                      {analytics.metrics.totalActivityEvents.toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-muted/30 border border-border p-4 rounded-xl">
                    <p className="text-[11px] text-muted-foreground uppercase font-semibold">Avg API Response</p>
                    <div className="text-2xl font-bold text-amber-500 mt-1">
                      {analytics.metrics.avgResponseMs} ms
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 border border-border p-5 rounded-xl space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    HTTP Response Status Code Breakdown
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                        <span>2xx Success (98.4%)</span>
                        <span className="text-emerald-500 font-semibold">Healthy</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '98.4%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                        <span>4xx Client Errors (1.2%)</span>
                        <span className="text-amber-500 font-semibold">Normal</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-amber-500 h-2 rounded-full" style={{ width: '1.2%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1">
                        <span>5xx Server Errors (0.4%)</span>
                        <span className="text-rose-500 font-semibold">Low</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-rose-500 h-2 rounded-full" style={{ width: '0.4%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 5: EMAIL TEMPLATE MANAGER ─────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> Email Template Management
              </CardTitle>
              <CardDescription className="text-xs">
                Create, edit, preview, and toggle email notification templates for AutoEOD reports and announcements.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsCreatingTemplate(true)}
                className="gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Template
              </Button>
              <Button variant="ghost" size="icon" onClick={loadTemplates} disabled={loadingTemplates}>
                <RefreshCw className={`w-4 h-4 ${loadingTemplates ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Create Template Form */}
            {isCreatingTemplate && (
              <form onSubmit={handleCreateTemplate} className="p-4 bg-muted/40 border border-border rounded-xl space-y-4">
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <h3 className="text-sm font-semibold text-foreground">Create New Email Template</h3>
                  <Button variant="ghost" size="sm" onClick={() => setIsCreatingTemplate(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    placeholder="Template Key (e.g. welcome_email)"
                    required
                    value={newTemplate.key}
                    onChange={(e) => setNewTemplate({ ...newTemplate, key: e.target.value })}
                  />
                  <Input
                    placeholder="Template Name"
                    required
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  />
                </div>

                <Input
                  placeholder="Email Subject (e.g. Welcome {{userName}}!)"
                  required
                  value={newTemplate.subject}
                  onChange={(e) => setNewTemplate({ ...newTemplate, subject: e.target.value })}
                />

                <textarea
                  rows={4}
                  placeholder="HTML Body Template..."
                  required
                  value={newTemplate.bodyHtml}
                  onChange={(e) => setNewTemplate({ ...newTemplate, bodyHtml: e.target.value })}
                  className="w-full bg-background border border-input rounded-xl p-3 text-xs text-foreground focus:outline-none"
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreatingTemplate(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Save Template
                  </Button>
                </div>
              </form>
            )}

            {/* Templates List */}
            {loadingTemplates ? (
              <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                Loading templates...
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-4 bg-muted/20 border border-border rounded-xl space-y-3">
                    {editingTemplate?.id === tpl.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editingTemplate.name}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        />
                        <Input
                          value={editingTemplate.subject}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                        />
                        <textarea
                          rows={4}
                          value={editingTemplate.bodyHtml}
                          onChange={(e) => setEditingTemplate({ ...editingTemplate, bodyHtml: e.target.value })}
                          className="w-full bg-background border border-input rounded-xl p-3 text-xs text-foreground focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(null)}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleSaveTemplate(editingTemplate)}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">{tpl.name}</h3>
                            <Badge variant="outline" className="text-[10px]">
                              {tpl.key}
                            </Badge>
                            <Badge variant={tpl.enabled ? 'default' : 'secondary'} className="text-[10px]">
                              {tpl.enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2">
                            <Switch
                              checked={tpl.enabled}
                              onCheckedChange={() => handleToggleTemplate(tpl)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingTemplate(tpl)}
                            >
                              <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTemplate(tpl.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </Button>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1">
                          <strong className="text-foreground">Subject:</strong> {tpl.subject}
                        </p>
                        <div className="mt-2 p-3 bg-muted/40 rounded-lg text-xs font-mono text-muted-foreground overflow-x-auto">
                          {tpl.bodyHtml}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── TAB 6: PINO & DATABASE AUDIT LOGS ─────────────────────────────────── */}
      {activeTab === 'audit' && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-primary" /> System Audit Logs (Pino & Database)
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time security and administrative audit event trail.
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={loadAuditLogs} disabled={loadingAuditLogs}>
              <RefreshCw className={`w-4 h-4 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>

          <CardContent className="pt-4">
            {loadingAuditLogs ? (
              <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                Loading audit logs...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Level</th>
                      <th className="py-3 px-4">User ID</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-foreground">{log.action}</td>
                        <td className="py-2.5 px-4">
                          <Badge
                            variant={
                              log.level === 'error'
                                ? 'destructive'
                                : log.level === 'warn'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {log.level}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">{log.userId || 'system'}</td>
                        <td className="py-2.5 px-4 text-muted-foreground truncate max-w-xs">
                          {log.details || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
