// apps/web/src/pages/IntegrationsPage.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Github, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, Lock } from 'lucide-react'
import { getAccessToken } from '@/lib/api'
import { integrations, extensionTokens } from '@/lib/api'; import { MessageSquare, Copy } from 'lucide-react'; import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const COMING_SOON = [
  { name: 'Jira', description: 'Track issues and sprint progress', icon: '🎯' },
  { name: 'Slack', description: 'Include message activity', icon: '💬' },
  { name: 'Linear', description: 'Sync with Linear issues', icon: '📐' },
  { name: 'Notion', description: 'Log to Notion databases', icon: '📝' },
]

export function IntegrationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrations.get,
  })

  const disconnectMutation = useMutation({
    mutationFn: integrations.disconnectGitHub,
    onSuccess: () => {
      toast.success('GitHub disconnected')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const syncMutation = useMutation({
    mutationFn: integrations.syncGitHub,
    onSuccess: () => {
      toast.success('Sync queued successfully')
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['integrations'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        queryClient.invalidateQueries({ queryKey: ['activity'] })
      }, 2000)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const { data: tokens, isLoading: isLoadingTokens } = useQuery({
    queryKey: ['extensionTokens'],
    queryFn: extensionTokens.list,
  });

  const generateTokenMutation = useMutation({
    mutationFn: (label: string) => extensionTokens.create(label),
    onSuccess: (data) => {
      setNewToken(data.token!);
      toast.success('Token generated successfully');
      queryClient.invalidateQueries({ queryKey: ['extensionTokens'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeTokenMutation = useMutation({
    mutationFn: (id: string) => extensionTokens.revoke(id),
    onSuccess: () => {
      toast.success('Token revoked');
      queryClient.invalidateQueries({ queryKey: ['extensionTokens'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [newToken, setNewToken] = useState<string | null>(null);

  const handleConnect = () => {
    const tok = getAccessToken()
    if (!tok) {
      toast.error('Please log in first')
      return
    }
    // Pass the token as a query param since browser redirects can't set headers
    window.location.href = `/api/integrations/github/connect?token=${encodeURIComponent(tok)}`
  }

  const github = data?.github

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Integrations</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your tools to auto-track daily work activity
        </p>
      </div>

      {/* GitHub integration */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Active Integrations
        </h3>
        <Card>
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 border border-border ring-1 ring-white/5 shrink-0">
              <Github className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">GitHub</CardTitle>
              <CardDescription>Track commits, pull requests, reviews, and issues</CardDescription>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : github?.connected ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : github?.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">@{github.username}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {github.lastSyncedAt
                          ? `Last synced ${formatDistanceToNow(new Date(github.lastSyncedAt))} ago`
                          : 'Never synced — first sync in progress'}
                      </span>
                      <span>·</span>
                      <span>Scopes: {github.scopes}</span>
                    </div>
                  </div>
                  {github.needsReconnect && (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Needs reconnect
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {github.needsReconnect && (
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      id="btn-reconnect-github"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reconnect
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast.info('Syncing...', { duration: 2000 })
                      syncMutation.mutate()
                    }}
                    disabled={syncMutation.isPending || disconnectMutation.isPending}
                    id="btn-sync-github"
                  >
                    {syncMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sync Now
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm('Disconnect GitHub? This will stop tracking your activity.')) {
                        disconnectMutation.mutate()
                      }
                    }}
                    disabled={disconnectMutation.isPending}
                    id="btn-disconnect-github"
                  >
                    {disconnectMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Connect GitHub to start tracking your commits, PRs, and reviews automatically.
                </p>
                <Button onClick={handleConnect} id="btn-connect-github" className="shrink-0 ml-4">
                  <Github className="h-4 w-4" />
                  Connect GitHub
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ChatGPT Extension */}
        <Card className="mt-4">
          <CardHeader className="flex flex-row items-center gap-4 pb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-900 border border-border ring-1 ring-white/5 shrink-0">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">ChatGPT (Browser Extension)</CardTitle>
                <Badge variant="secondary" className="text-[10px]">Beta / Manual Install</Badge>
              </div>
              <CardDescription>Capture your ChatGPT activity via the AutoEOD browser extension</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {newToken && (
              <div className="p-4 mb-4 bg-green-900/20 border border-green-500/50 rounded-lg">
                <p className="text-sm font-semibold mb-2">Save this token now! You won't be able to see it again.</p>
                <div className="flex gap-2">
                  <input readOnly value={newToken} className="flex-1 bg-black/50 p-2 rounded text-sm font-mono" />
                  <Button size="icon" onClick={() => {
                    navigator.clipboard.writeText(newToken);
                    toast.success('Copied to clipboard');
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Load the unpacked extension from `apps/extension` into your browser.
                </p>
                <Button 
                  onClick={() => generateTokenMutation.mutate('Browser Extension')}
                  disabled={generateTokenMutation.isPending}
                >
                  {generateTokenMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Token
                </Button>
              </div>

              {tokens && tokens.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-semibold">Active Tokens</p>
                  {tokens.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="space-y-1">
                        <p className="text-sm">{t.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {formatDistanceToNow(new Date(t.createdAt))} ago
                          {t.lastUsedAt && ` Â· Last used ${formatDistanceToNow(new Date(t.lastUsedAt))} ago`}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeTokenMutation.mutate(t.id)}
                        disabled={revokeTokenMutation.isPending}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming soon */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Coming Soon
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COMING_SOON.map((integration) => (
            <Card key={integration.name} className="opacity-60">
              <CardHeader className="flex flex-row items-center gap-3 pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-xl shrink-0">
                  {integration.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">{integration.name}</CardTitle>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Lock className="h-2.5 w-2.5" />
                      Phase 2
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{integration.description}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
