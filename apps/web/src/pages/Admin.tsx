import React, { useState, useEffect } from 'react';
import { admin, AdminSystemConfig, AdminUser, AdminHealth } from '@/lib/api';
import { toast } from 'sonner';
import {
  Shield,
  Server,
  Users,
  Settings,
  Activity,
  Database,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Globe,
  Lock,
} from 'lucide-react';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'users' | 'health'>('config');

  // Config State
  const [config, setConfig] = useState<AdminSystemConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Users State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Health State
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Load Config
  const loadConfig = async () => {
    setLoadingConfig(true);
    try {
      const data = await admin.getConfig();
      setConfig(data);
    } catch (err: any) {
      toast.error('Failed to load system config: ' + (err.message || 'Error'));
    } finally {
      setLoadingConfig(false);
    }
  };

  // Load Users
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

  // Load Health
  const loadHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await admin.getHealth();
      setHealth(data);
    } catch (err: any) {
      toast.error('Failed to load health status: ' + (err.message || 'Error'));
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'config') loadConfig();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'health') loadHealth();
  }, [activeTab]);

  // Handle Config Save
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
      toast.success('System configuration updated successfully');
    } catch (err: any) {
      toast.error('Failed to update config: ' + (err.message || 'Error'));
    } finally {
      setSavingConfig(false);
    }
  };

  // Handle User Role Change
  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      const updatedUser = await admin.updateUserRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: updatedUser.role } : u))
      );
      toast.success(`Updated user role to ${newRole}`);
    } catch (err: any) {
      toast.error('Failed to update user role: ' + (err.message || 'Error'));
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Admin & Remote Configuration Dashboard
            </h1>
            <p className="text-xs text-slate-400">
              Manage live system endpoints, user permissions, and infrastructure metrics.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-2 mt-4 md:mt-0 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'config'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Remote Config</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>User Management</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'health'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>System Health</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: REMOTE CONFIG MANAGER ──────────────────────────────────────── */}
      {activeTab === 'config' && (
        <div className="max-w-4xl space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-indigo-400" />
                  Dynamic Base URLs & Version Policy
                </h2>
                <p className="text-xs text-slate-400">
                  Client applications (Desktop app & Chrome Extension) fetch these endpoints dynamically on launch.
                </p>
              </div>
              <button
                onClick={loadConfig}
                disabled={loadingConfig}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh Config"
              >
                <RefreshCw className={`w-4 h-4 ${loadingConfig ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingConfig ? (
              <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
                Loading system configuration...
              </div>
            ) : config ? (
              <form onSubmit={handleSaveConfig} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* API Base URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Backend API Base URL
                    </label>
                    <input
                      type="url"
                      required
                      value={config.apiBaseUrl}
                      onChange={(e) => setConfig({ ...config, apiBaseUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      placeholder="https://autoeod.onrender.com"
                    />
                    <p className="text-[11px] text-slate-500">
                      Primary API endpoint used by Desktop Agent & Extension.
                    </p>
                  </div>

                  {/* Web Base URL */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Frontend Web App URL
                    </label>
                    <input
                      type="url"
                      required
                      value={config.webBaseUrl}
                      onChange={(e) => setConfig({ ...config, webBaseUrl: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      placeholder="https://autoeod.vercel.app"
                    />
                    <p className="text-[11px] text-slate-500">
                      Public Web Dashboard URL.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Min Extension Version */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Min Extension Version Required
                    </label>
                    <input
                      type="text"
                      value={config.minExtensionVersion}
                      onChange={(e) => setConfig({ ...config, minExtensionVersion: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Min Desktop Version */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Min Desktop Version Required
                    </label>
                    <input
                      type="text"
                      value={config.minDesktopVersion}
                      onChange={(e) => setConfig({ ...config, minDesktopVersion: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                  {/* Maintenance Mode */}
                  <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-white flex items-center gap-2">
                        <Lock className="w-4 h-4 text-amber-400" />
                        Maintenance Mode
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Informs client apps that maintenance is underway.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, maintenanceMode: !config.maintenanceMode })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.maintenanceMode ? 'bg-amber-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Force Update */}
                  <div className="flex items-center justify-between p-4 bg-slate-950 border border-slate-800/80 rounded-xl">
                    <div>
                      <span className="text-sm font-medium text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        Force Update Required
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Prompts client apps to download mandatory updates.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, forceUpdate: !config.forceUpdate })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.forceUpdate ? 'bg-rose-500' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.forceUpdate ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2"
                  >
                    {savingConfig && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Save Configuration</span>
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      )}

      {/* ── TAB 2: USER MANAGEMENT ────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  User Accounts & Roles
                </h2>
                <p className="text-xs text-slate-400">
                  Manage registered users and assign Administrator permissions.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-64"
                />
                <button
                  onClick={loadUsers}
                  disabled={loadingUsers}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
                Loading user accounts...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Joined Date</th>
                      <th className="py-3.5 px-4">Reports</th>
                      <th className="py-3.5 px-4">Events</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-semibold text-white">{u.name}</span>
                            <p className="text-[11px] text-slate-400">{u.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              u.role === 'ADMIN'
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-slate-400">{u._count.reports}</td>
                        <td className="py-3 px-4 text-slate-400">{u._count.activityEvents}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleRole(u.id, u.role)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
                          >
                            {u.role === 'ADMIN' ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: SYSTEM HEALTH & INFRASTRUCTURE MONITORING ─────────────────── */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-400" />
                  Infrastructure & Worker Queue Metrics
                </h2>
                <p className="text-xs text-slate-400">
                  Live diagnostics for Neon PostgreSQL, Upstash Redis, and BullMQ background queues.
                </p>
              </div>

              <button
                onClick={loadHealth}
                disabled={loadingHealth}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
              >
                <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingHealth ? (
              <div className="py-12 text-center text-slate-500 text-sm animate-pulse">
                Pinging database & queue metrics...
              </div>
            ) : health ? (
              <div className="space-y-6">
                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Database Card */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Database className="w-4 h-4 text-emerald-400" />
                        Neon PostgreSQL Database
                      </span>
                      {health.database.status === 'healthy' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" /> {health.database.status}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {health.database.latencyMs !== undefined ? `${health.database.latencyMs} ms` : 'N/A'}
                      <span className="text-xs font-normal text-slate-400 ml-2">Latency</span>
                    </div>
                  </div>

                  {/* Redis Card */}
                  <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Radio className="w-4 h-4 text-rose-400" />
                        Upstash Redis Infrastructure
                      </span>
                      {health.redis.status === 'healthy' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3" /> {health.redis.status}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {health.redis.latencyMs !== undefined ? `${health.redis.latencyMs} ms` : 'N/A'}
                        </div>
                        <p className="text-[11px] text-slate-400">TLS Latency</p>
                      </div>

                      <div>
                        <div className="text-2xl font-bold text-indigo-400">
                          {health.redis.totalCommands !== undefined ? health.redis.totalCommands.toLocaleString() : 'N/A'}
                        </div>
                        <p className="text-[11px] text-slate-400">Total Processed Commands</p>
                      </div>
                    </div>

                    {health.redis.totalReads !== undefined && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                        <div>
                          Reads: <span className="text-emerald-400 font-semibold">{health.redis.totalReads?.toLocaleString()}</span>
                        </div>
                        <div>
                          Writes: <span className="text-amber-400 font-semibold">{health.redis.totalWrites?.toLocaleString()}</span>
                        </div>
                        <div>
                          Keys: <span className="text-indigo-400 font-semibold">{health.redis.totalKeys}</span> ({health.redis.dataSize})
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Queue Stats Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    BullMQ Queue Job Stats
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {Object.entries(health.queues).map(([name, counts]) => (
                      <div key={name} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <div className="text-xs font-semibold text-white truncate">{name}</div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                          <div>
                            Waiting: <span className="text-amber-400 font-semibold">{counts.waiting}</span>
                          </div>
                          <div>
                            Active: <span className="text-indigo-400 font-semibold">{counts.active}</span>
                          </div>
                          <div>
                            Completed: <span className="text-emerald-400 font-semibold">{counts.completed}</span>
                          </div>
                          <div>
                            Failed: <span className="text-rose-400 font-semibold">{counts.failed}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
