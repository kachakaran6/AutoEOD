// apps/web/src/pages/SettingsPage.tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Info, CheckCircle2, XCircle } from 'lucide-react'
import { settings as settingsApi, extensionSettings as extSettingsApi, getAccessToken } from '@/lib/api'
import type { UserSettings, UserExtensionSettings } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { toast } from 'sonner'

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
]

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  })

  const { data: extData, isLoading: extLoading } = useQuery({
    queryKey: ['extensionSettings'],
    queryFn: extSettingsApi.get,
  })

  const [form, setForm] = useState<Partial<UserSettings>>({})
  const [extForm, setExtForm] = useState<Partial<UserExtensionSettings>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [extIsDirty, setExtIsDirty] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data)
      setIsDirty(false)
    }
  }, [data])

  useEffect(() => {
    if (extData) {
      setExtForm(extData)
      setExtIsDirty(false)
    }
  }, [extData])

  const updateField = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  const updateExtField = <K extends keyof UserExtensionSettings>(key: K, value: UserExtensionSettings[K]) => {
    setExtForm((prev) => ({ ...prev, [key]: value }))
    setExtIsDirty(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isDirty) await settingsApi.update(form)
      if (extIsDirty) await extSettingsApi.update(extForm)
    },
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['extensionSettings'] })
      setIsDirty(false)
      setExtIsDirty(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => settingsApi.disconnectEmail(),
    onSuccess: () => {
      toast.success('Email provider disconnected')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground text-sm mt-1">Configure your work schedule and report preferences</p>
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={(!isDirty && !extIsDirty) || saveMutation.isPending}
          id="btn-save-settings"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Work Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Work Schedule</CardTitle>
          <CardDescription>Used to determine your work window for activity tracking and report generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setting-timezone">Timezone</Label>
            <Select
              value={form.timezone || 'Asia/Kolkata'}
              onValueChange={(v) => updateField('timezone', v)}
            >
              <SelectTrigger id="setting-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="setting-work-start">Work Start</Label>
              <Input
                id="setting-work-start"
                type="time"
                value={form.workStartTime || '09:00'}
                onChange={(e) => updateField('workStartTime', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setting-work-end">Work End</Label>
              <Input
                id="setting-work-end"
                type="time"
                value={form.workEndTime || '18:00'}
                onChange={(e) => updateField('workEndTime', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setting-report-time">Daily Report Time</Label>
            <Input
              id="setting-report-time"
              type="time"
              value={form.reportTime || '17:50'}
              onChange={(e) => updateField('reportTime', e.target.value)}
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              AI report will be auto-generated at this time in your timezone
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="setting-auto-generate" className="text-sm font-medium">Auto-generate reports</Label>
              <p className="text-xs text-muted-foreground">Automatically generate your EOD report at the configured time</p>
            </div>
            <Switch
              id="setting-auto-generate"
              checked={form.autoGenerate ?? true}
              onCheckedChange={(v) => updateField('autoGenerate', v)}
            />
          </div>
          
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="setting-auto-send" className="text-sm font-medium">Auto-send reports</Label>
              <p className="text-xs text-muted-foreground">Automatically send the report to your manager at the configured time (skips manual review)</p>
            </div>
            <Switch
              id="setting-auto-send"
              checked={form.autoSend ?? false}
              onCheckedChange={(v) => updateField('autoSend', v)}
              disabled={!(form.autoGenerate ?? true)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Delivery</CardTitle>
          <CardDescription>Where to send your EOD reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setting-manager-email">Manager's email</Label>
            <Input
              id="setting-manager-email"
              type="email"
              placeholder="manager@company.com"
              value={form.managerEmail || ''}
              onChange={(e) => updateField('managerEmail', e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground">
              Required to use "Approve & Send". Reports won't send until this is set.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="setting-cc-emails">CC emails (optional)</Label>
            <Input
              id="setting-cc-emails"
              type="text"
              placeholder="cc1@company.com, cc2@company.com"
              value={form.ccEmails || ''}
              onChange={(e) => updateField('ccEmails', e.target.value || null)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of email addresses to CC</p>
          </div>
        </CardContent>
      </Card>

      {/* Email Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Email Provider</span>
            {data?.emailConnection ? (
              <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Connected
              </span>
            ) : (
              <span className="flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Not Configured
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Connect your email account securely to send EOD reports directly from your mailbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.emailConnection ? (
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  {data.emailConnection.avatar ? (
                    <img src={data.emailConnection.avatar} alt="Avatar" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium uppercase text-muted-foreground">
                      {data.emailConnection.email[0]}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      🟢 {data.emailConnection.provider === 'google' ? 'Gmail' : 'Zoho Mail'} Connected
                    </p>
                    {data.emailConnection.provider === 'google' && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">Google</span>
                    )}
                    {data.emailConnection.provider === 'zoho' && (
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">Zoho</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{data.emailConnection.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Connected {new Date(data.emailConnection.connectedAt).toLocaleDateString()}
                    {data.emailConnection.lastUsedAt && ` • Last email sent: ${new Date(data.emailConnection.lastUsedAt).toLocaleString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={((import.meta as any).env.VITE_API_URL || '/api') + (data.emailConnection.provider === 'google' ? '/auth/google/connect' : '/auth/zoho/connect') + `?token=${getAccessToken()}`}>
                    Reconnect
                  </a>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                  {disconnectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-16 flex justify-start gap-4 px-4 hover:bg-slate-50" asChild>
                  <a href={`${(import.meta as any).env.VITE_API_URL || '/api'}/auth/google/connect?token=${getAccessToken()}`}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Gmail
                  </a>
                </Button>
                <Button variant="outline" className="h-16 flex justify-start gap-4 px-4 hover:bg-slate-50" asChild>
                  <a href={`${(import.meta as any).env.VITE_API_URL || '/api'}/auth/zoho/connect?token=${getAccessToken()}`}>
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" color="#e4342b">
                      <path d="M12.44 2.89L20.8 7.72c.44.25.71.72.71 1.23v9.64c0 .5-.27.97-.71 1.23l-8.36 4.82c-.44.26-.98.26-1.42 0l-8.36-4.82c-.44-.25-.71-.72-.71-1.23V8.95c0-.5.27-.97.71-1.23l8.36-4.82c.45-.26.98-.26 1.42 0zM12 16.5c-2.48 0-4.5-2.02-4.5-4.5s2.02-4.5 4.5-4.5 4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5zm0-7c-1.38 0-2.5 1.12-2.5 2.5s1.12 2.5 2.5 2.5 2.5-1.12 2.5-2.5-1.12-2.5-2.5-2.5z" />
                    </svg>
                    Continue with Zoho Mail
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Secure OAuth authentication. We never ask for your email password.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Style */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Style</CardTitle>
          <CardDescription>Customize how the AI writes your reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="setting-template">Report tone</Label>
            <Select
              value={form.reportTemplate || 'professional'}
              onValueChange={(v) => updateField('reportTemplate', v)}
            >
              <SelectTrigger id="setting-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional — formal business tone</SelectItem>
                <SelectItem value="short">Short — brief and terse, 1-2 sentences</SelectItem>
                <SelectItem value="detailed">Detailed — granular, includes repo/file names</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="setting-language">Report language</Label>
            <Select
              value={form.reportLanguage || 'english'}
              onValueChange={(v) => updateField('reportLanguage', v)}
            >
              <SelectTrigger id="setting-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="hindi">Hindi (हिंदी)</SelectItem>
                <SelectItem value="gujarati">Gujarati (ગુજરાતી)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      {/* Activity Capture (Universal Radar) Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Capture</CardTitle>
          <CardDescription>
            This captures websites you visit during your work hours so you can pick what's relevant for your daily report. Nothing is shared with anyone else automatically — you choose what gets included, and you can pause or exclude any site at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/20">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Global Pause</Label>
              <p className="text-xs text-muted-foreground">Stop all tracking instantly, everywhere.</p>
            </div>
            <Switch
              checked={extForm.globalPaused ?? false}
              onCheckedChange={(v) => updateExtField('globalPaused', v)}
            />
          </div>

          <div className="space-y-2">
            <Label>Domain Exclusion List</Label>
            <p className="text-xs text-muted-foreground">Never track activity on these domains (e.g. personal email, banking).</p>
            <Input
              placeholder="e.g. gmail.com, chase.com (comma separated)"
              value={(extForm.excludedDomains || []).join(', ')}
              onChange={(e) => updateExtField('excludedDomains', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1 max-w-[80%]">
              <Label className="text-sm font-medium">Tier 1 Snapshot Global Default</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If on, we capture a short snippet of text from the pages you visit to give the AI context. We always skip password/payment pages.
              </p>
            </div>
            <Switch
              checked={extForm.tier1GlobalDefault ?? false}
              onCheckedChange={(v) => updateExtField('tier1GlobalDefault', v)}
            />
          </div>
          
          {!extForm.tier1GlobalDefault && (
            <div className="space-y-2">
              <Label>Tier 1 Allowed Domains</Label>
              <p className="text-xs text-muted-foreground">Only capture snippets on these domains.</p>
              <Input
                placeholder="e.g. github.com, notion.so (comma separated)"
                value={(extForm.tier1DomainAllowlist || []).join(', ')}
                onChange={(e) => updateExtField('tier1DomainAllowlist', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1 max-w-[80%]">
              <Label htmlFor="setting-chatgpt-capture" className="text-sm font-medium">Capture ChatGPT message content (Tier 2)</Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Off: we only see conversation titles and timing. On: we also capture short excerpts of your messages, to help the AI understand what you worked on. Off is recommended unless you want more detailed reports.
              </p>
            </div>
            <Switch
              id="setting-chatgpt-capture"
              checked={form.chatgptCaptureContent ?? false}
              onCheckedChange={(v) => updateField('chatgptCaptureContent', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
