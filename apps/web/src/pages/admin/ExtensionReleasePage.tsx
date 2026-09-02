// apps/web/src/pages/admin/ExtensionReleasePage.tsx
import React, { useState } from 'react';
import { admin } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DownloadCloud,
  Github,
  CheckCircle2,
  Download,
  ExternalLink,
  Package,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

export default function ExtensionReleasePage() {
  const [tag, setTag] = useState(`v1.0.${Math.floor(Date.now() / 1000)}`);
  const [githubToken, setGithubToken] = useState('');
  const [repo, setRepo] = useState('kachakaran6/AutoEOD');
  const [apiBaseUrl, setApiBaseUrl] = useState('https://autoeod-be.kachakaran.tech');
  const [building, setBuilding] = useState(false);
  const [releaseResult, setReleaseResult] = useState<any>(null);

  const handleBuildRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setBuilding(true);
    setReleaseResult(null);
    try {
      const res = await admin.releaseExtension({
        tag,
        githubToken: githubToken || undefined,
        repo,
        apiBaseUrl,
      });

      setReleaseResult(res);
      toast.success('Extension packaged and release built successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to build extension release');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <DownloadCloud className="h-6 w-6 text-primary" /> Chrome Extension Release Publisher
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Package the Chrome extension into a standalone ZIP, create GitHub releases, and generate direct download links
        </p>
      </div>

      <form onSubmit={handleBuildRelease} className="space-y-6">
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Release Build Configuration</CardTitle>
            <CardDescription className="text-xs">Specify release tag and optional GitHub token for automated deployment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Release Tag</Label>
                <Input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Repository</Label>
                <Input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">API Base URL Embedded in Build</Label>
              <Input
                type="url"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">GitHub Personal Access Token (Optional)</Label>
              <Input
                type="password"
                placeholder="ghp_... (leave blank for local direct ZIP only)"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                If provided with 'repo' scope, a GitHub release will be created automatically.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={building} className="gap-2">
                <Package className="h-4 w-4" /> {building ? 'Packaging Extension...' : 'Build & Package Extension'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Release Result Card */}
      {releaseResult && (
        <Card className="border-emerald-500/40 bg-emerald-950/10 shadow-lg animate-in fade-in">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-sm font-bold text-foreground">Extension Package Ready</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Release Tag:</span>
                <span className="font-bold text-primary">{releaseResult.tag}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bundle Size:</span>
                <span className="text-foreground">{Math.round(releaseResult.sizeBytes / 1024)} KB</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a href="/api/admin/download-extension" download>
                <Button size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> Download ZIP
                </Button>
              </a>

              {releaseResult.releaseUrl && (
                <a href={releaseResult.releaseUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Github className="h-4 w-4" /> View GitHub Release <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
