// apps/web/src/pages/admin/UserTimelinePage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { admin, AuditEventItem } from '@/lib/api';
import { StatusBadge } from '@/components/admin/StatusBadges';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  RefreshCw,
  User,
  Clock,
  ExternalLink,
  Shield,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';

export default function UserTimelinePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<{ id: string; name: string; email: string; createdAt: string } | null>(null);
  const [timeline, setTimeline] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await admin.getUserTimeline(userId);
      setUserData(res.user);
      setTimeline(res.timeline);
    } catch {
      toast.error('Failed to load user timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [userId]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/audit/users')}
          className="gap-2 text-xs h-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to User Audit
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchTimeline}
          disabled={loading}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Timeline
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-mono">Reconstructing user chronological timeline...</p>
        </div>
      ) : !userData ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          User not found.
        </div>
      ) : (
        <>
          {/* User Profile Card */}
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg ring-1 ring-primary/20">
                  {userData.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{userData.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{userData.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    User ID: <span className="font-mono text-foreground">{userData.id}</span> • Member since:{' '}
                    {new Date(userData.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chronological Timeline */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Activity History ({timeline.length} events)
            </h3>

            {timeline.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-border bg-card text-xs text-muted-foreground">
                No activity recorded for this user yet.
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 border-border/80 space-y-6">
                {timeline.map((ev) => (
                  <div key={ev.id} className="relative group">
                    {/* Bullet marker */}
                    <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-primary ring-2 ring-primary/20" />

                    <div className="p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={ev.status} />
                          <span className="font-mono font-bold text-xs text-foreground">{ev.action}</span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono h-4 px-1 py-0">
                            {ev.category}
                          </Badge>
                        </div>

                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>

                      {ev.details && Object.keys(ev.details).length > 0 && (
                        <pre className="p-3 rounded-lg bg-muted/40 font-mono text-[11px] text-foreground overflow-x-auto">
                          {JSON.stringify(ev.details, null, 2)}
                        </pre>
                      )}

                      <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground pt-1">
                        {ev.ipAddress && <span>IP: {ev.ipAddress}</span>}
                        {ev.traceId && (
                          <button
                            onClick={() => navigate(`/admin/traces/${ev.traceId}`)}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            Trace: {ev.traceId.slice(0, 12)}... <ExternalLink className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
