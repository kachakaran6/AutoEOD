// apps/web/src/pages/admin/UserManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { admin, AdminUser } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Search,
  RefreshCw,
  History,
  Shield,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';

export default function UserManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await admin.getUsers();
      setUsers(data);
    } catch {
      toast.error('Failed to load users list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (user: AdminUser) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setUpdatingId(user.id);
    try {
      await admin.updateUserRole(user.id, newRole);
      toast.success(`User role updated to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user role');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="h-6 w-6 text-primary" /> User Governance & Access Roles
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage user accounts, assign administrative privileges, and inspect individual activity histories
          </p>
        </div>

        <Button
          variant="default"
          size="sm"
          onClick={fetchUsers}
          disabled={loading}
          className="text-xs h-8 gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Search Toolbar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Filter users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-xs font-mono bg-card"
        />
      </div>

      {/* Users Table */}
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
        <div className="p-3.5 border-b border-border/60 bg-muted/20 text-xs text-muted-foreground">
          Showing <strong className="text-foreground">{filteredUsers.length}</strong> of {users.length} registered users
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left divide-y divide-border/60">
            <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] tracking-wider font-sans">
              <tr>
                <th className="px-4 py-3">User & Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Reports</th>
                <th className="px-4 py-3 text-right">Activities</th>
                <th className="px-4 py-3 text-right">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No users match your filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground font-sans">{u.name}</div>
                      <div className="text-[11px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          u.role === 'ADMIN'
                            ? 'bg-purple-500/15 text-purple-500 border-purple-500/30 text-[10px]'
                            : 'bg-muted text-muted-foreground text-[10px]'
                        }
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{u._count?.reports || 0}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{u._count?.activityEvents || 0}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 font-sans"
                          onClick={() => navigate(`/admin/audit/users/${u.id}/timeline`)}
                        >
                          <History className="h-3 w-3 text-primary" /> Timeline
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updatingId === u.id}
                          className="h-7 text-xs font-sans"
                          onClick={() => handleToggleRole(u)}
                        >
                          {u.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
