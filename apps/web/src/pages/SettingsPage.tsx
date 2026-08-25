// apps/web/src/pages/SettingsPage.tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Info, CheckCircle2, XCircle, Eye, Palette, Sun, Moon, Monitor, Sparkles, Check } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { settings as settingsApi, extensionSettings as extSettingsApi, getAccessToken, BASE_URL } from '@/lib/api'
import type { UserSettings, UserExtensionSettings } from '@/lib/api'
import { renderProfessional, renderMinimalist, renderModern, renderExecutive, renderCreative, renderQwintsoft } from '@/lib/email-templates'
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
import { WorkingSchedule } from '@/components/WorkingSchedule'


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

  const { theme, setTheme, accentColor, setAccentColor, accentOptions } = useTheme()

  const currentAccent = accentOptions.find((a) => a.id === accentColor)

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
        <div className="flex-1"></div>
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

      {/* ── Appearance & Theme Studio ──────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/70 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                Appearance & Theme Studio
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Customize your color scheme, dark/light canvas mode, and personalized accent palette.
              </CardDescription>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium capitalize flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${currentAccent?.bgClass || 'bg-primary'}`} />
              {currentAccent?.label}
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {/* Theme Mode Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Interface Mode
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'light' as const,
                  label: 'Light Mode',
                  desc: 'Soft slate & crisp daytime surfaces',
                  icon: Sun,
                  iconColor: 'text-amber-500',
                  previewBg: 'bg-slate-100 border-slate-300',
                },
                {
                  id: 'dark' as const,
                  label: 'Dark Mode',
                  desc: 'Deep obsidian luxury dark canvas',
                  icon: Moon,
                  iconColor: 'text-indigo-400',
                  previewBg: 'bg-slate-950 border-slate-800',
                },
                {
                  id: 'system' as const,
                  label: 'System Match',
                  desc: 'Synchronize with OS system preferences',
                  icon: Monitor,
                  iconColor: 'text-sky-400',
                  previewBg: 'bg-gradient-to-r from-slate-200 to-slate-900 border-slate-400',
                },
              ].map((item) => {
                const isSelected = theme === item.id;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id)}
                    className={`flex flex-col text-left p-4 rounded-xl border transition-all duration-150 relative ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-1 ring-primary'
                        : 'border-border bg-card/60 hover:bg-muted/50 hover:border-border/80'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        <IconComponent className={`w-4 h-4 ${item.iconColor}`} />
                        <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color Palettes */}
          <div className="space-y-2.5 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Accent Color
              </Label>
              <span className="text-xs text-primary font-medium">
                {currentAccent?.label}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {accentOptions.map((opt) => {
                const isSelected = accentColor === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setAccentColor(opt.id);
                      toast.success(`Accent color set to ${opt.label}`);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all duration-150 text-xs font-medium ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-sm shadow-primary/20 scale-[1.02]'
                        : 'border-border bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 shadow-sm ${opt.bgClass}`}
                    >
                      {isSelected && (
                        <Check className="w-2.5 h-2.5 text-white stroke-[3.5]" />
                      )}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Schedule */}
      <WorkingSchedule 
        workingDays={form.workingDays || [1,2,3,4,5]} 
        onChange={(days) => updateField('workingDays', days)} 
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Report Config</CardTitle>
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
          
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="setting-include-radar" className="text-sm font-medium">Auto-include Radar Logs</Label>
              <p className="text-xs text-muted-foreground">Automatically summarize and include your Activity Radar logs when generating reports</p>
            </div>
            <Switch
              id="setting-include-radar"
              checked={form.includeRadarLogs ?? false}
              onCheckedChange={(v) => updateField('includeRadarLogs', v)}
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
                  <a href={`${BASE_URL}${data.emailConnection.provider === 'google' ? '/auth/google/connect' : '/auth/zoho/connect'}?token=${getAccessToken()}`}>
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
                  <a href={`${BASE_URL}/auth/google/connect?token=${getAccessToken()}`}>
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
                  <a href={`${BASE_URL}/auth/zoho/connect?token=${getAccessToken()}`}>
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
          <div className="space-y-3">
            <Label>Email Template Design</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <TemplateCard 
                id="professional" 
                title="Professional" 
                description="Clean, formal, standard"
                isSelected={(form.reportTemplate || 'professional') === 'professional'}
                onClick={() => updateField('reportTemplate', 'professional')}
                previewCss={<PreviewProfessional />}
              />
              <TemplateCard 
                id="minimalist" 
                title="Minimalist" 
                description="Monochrome, typography"
                isSelected={form.reportTemplate === 'minimalist'}
                onClick={() => updateField('reportTemplate', 'minimalist')}
                previewCss={<PreviewMinimalist />}
              />
              <TemplateCard 
                id="modern" 
                title="Modern" 
                description="Rounded, colorful badges"
                isSelected={form.reportTemplate === 'modern'}
                onClick={() => updateField('reportTemplate', 'modern')}
                previewCss={<PreviewModern />}
              />
              <TemplateCard 
                id="executive" 
                title="Executive" 
                description="High contrast, formal navy"
                isSelected={form.reportTemplate === 'executive'}
                onClick={() => updateField('reportTemplate', 'executive')}
                previewCss={<PreviewExecutive />}
              />
              <TemplateCard 
                id="creative" 
                title="Creative" 
                description="Vibrant gradients, playful"
                isSelected={form.reportTemplate === 'creative'}
                onClick={() => updateField('reportTemplate', 'creative')}
                previewCss={<PreviewCreative />}
              />
              <TemplateCard 
                id="qwintsoft" 
                title="Qwintsoft" 
                description="Plain text daily updates"
                isSelected={form.reportTemplate === 'qwintsoft'}
                onClick={() => updateField('reportTemplate', 'qwintsoft')}
                previewCss={<PreviewQwintsoft />}
              />
            </div>
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

const dummyReport = {
  reportDate: new Date().toLocaleDateString(),
  summary: "Completed integration of the new email templates and fixed the extension API crash issue. Everything is running smoothly.",
  completedItems: ["Added 5 new visual email templates", "Fixed API encoding crash (22P05)", "Updated Settings UI with visual previews"],
  inProgressItems: ["Reviewing mobile responsiveness of settings page", "Writing unit tests for template renderers"],
  blockers: "Waiting on design assets for the new logo.",
  tomorrowPlan: "Will deploy the changes to staging and begin monitoring worker stability.",
};

function getPreviewHtml(template: string, senderName: string) {
  switch (template) {
    case 'minimalist': return renderMinimalist(dummyReport, senderName);
    case 'modern': return renderModern(dummyReport, senderName);
    case 'executive': return renderExecutive(dummyReport, senderName);
    case 'creative': return renderCreative(dummyReport, senderName);
    case 'qwintsoft': return renderQwintsoft(dummyReport, senderName);
    default: return renderProfessional(dummyReport, senderName);
  }
}

function TemplateCard({ id, title, description, isSelected, onClick, previewCss }: any) {
  const html = getPreviewHtml(id, "Jane Doe");
  return (
    <Dialog>
      <div 
        className={`relative rounded-xl border-2 overflow-hidden transition-all duration-200 ${isSelected ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/50 bg-card'}`}
      >
        <div 
           className="h-32 w-full bg-muted/30 p-2 flex items-center justify-center cursor-pointer relative group"
           onClick={onClick}
        >
          <div className="w-[120px] bg-white border border-border shadow-sm rounded-md overflow-hidden transform scale-110 origin-center transition-transform pointer-events-none">
             {previewCss}
          </div>
          <DialogTrigger asChild>
            <Button 
               variant="secondary" 
               size="icon" 
               className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-border"
               onClick={(e) => e.stopPropagation()}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </div>
        <div className="p-3 border-t border-border cursor-pointer" onClick={onClick}>
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-sm">{title}</p>
            {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden bg-slate-100 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-white">
          <DialogTitle>{title} Template Preview</DialogTitle>
          <DialogDescription>This is exactly how your email will look in the recipient's inbox.</DialogDescription>
        </DialogHeader>
        <div className="flex-1 w-full flex items-center justify-center p-4">
          <div className="w-full max-w-3xl h-full bg-white rounded-lg shadow-sm border border-border overflow-hidden">
            <iframe 
              srcDoc={html} 
              className="w-full h-full border-0"
              title={`${title} Preview`}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const PreviewProfessional = () => (
  <div className="p-2 space-y-1 bg-white">
    <div className="h-2 w-16 bg-slate-800 rounded-sm mb-2" />
    <div className="h-1 w-10 bg-slate-400 rounded-sm mb-3" />
    <div className="p-1.5 bg-slate-100 rounded-sm space-y-1 mb-2">
      <div className="h-0.5 w-full bg-slate-300 rounded-full" />
      <div className="h-0.5 w-4/5 bg-slate-300 rounded-full" />
    </div>
    <div className="h-1 w-12 bg-slate-800 rounded-sm" />
    <div className="flex items-center gap-1 mt-1"><div className="h-0.5 w-0.5 rounded-full bg-slate-400"/><div className="h-0.5 w-16 bg-slate-300 rounded-full"/></div>
    <div className="flex items-center gap-1"><div className="h-0.5 w-0.5 rounded-full bg-slate-400"/><div className="h-0.5 w-12 bg-slate-300 rounded-full"/></div>
  </div>
);

const PreviewMinimalist = () => (
  <div className="p-2 space-y-1.5 font-serif border-b border-black bg-white">
    <div className="border-b border-black pb-1 mb-1">
      <div className="h-2 w-14 bg-black rounded-sm mb-0.5" />
      <div className="h-1 w-8 bg-gray-500 rounded-sm" />
    </div>
    <div className="h-0.5 w-full bg-gray-300 rounded-full" />
    <div className="h-0.5 w-full bg-gray-300 rounded-full" />
    <div className="h-1.5 w-10 bg-black rounded-sm mt-2" />
    <div className="flex items-center gap-1 mt-1"><div className="h-0.5 w-0.5 rounded-full bg-black"/><div className="h-0.5 w-14 bg-gray-400 rounded-full"/></div>
  </div>
);

const PreviewModern = () => (
  <div className="p-2 space-y-1.5 bg-slate-50">
    <div className="flex flex-col items-center mb-2">
      <div className="h-1.5 w-8 bg-black rounded-full mb-1" />
      <div className="h-2 w-12 bg-slate-800 rounded-sm mb-0.5" />
      <div className="h-1 w-6 bg-slate-400 rounded-sm" />
    </div>
    <div className="p-1 bg-white border border-slate-200 rounded-md shadow-sm mb-2">
      <div className="h-0.5 w-full bg-slate-300 rounded-full" />
    </div>
    <div className="h-1.5 w-10 bg-green-200 rounded-sm" />
    <div className="p-1 bg-white border border-slate-200 rounded-md shadow-sm">
      <div className="flex items-center gap-1"><div className="h-0.5 w-0.5 rounded-full bg-slate-400"/><div className="h-0.5 w-14 bg-slate-300 rounded-full"/></div>
    </div>
  </div>
);

const PreviewExecutive = () => (
  <div className="p-2 space-y-1 bg-white">
    <div className="border-b-2 border-blue-900 pb-1 mb-2">
      <div className="h-1.5 w-16 bg-blue-900 rounded-sm mb-1" />
      <div className="flex justify-between">
        <div className="h-0.5 w-8 bg-gray-400 rounded-sm" />
        <div className="h-0.5 w-6 bg-gray-400 rounded-sm" />
      </div>
    </div>
    <div className="h-1 w-12 bg-blue-900 rounded-sm" />
    <div className="h-0.5 w-full bg-gray-300 rounded-full" />
    <div className="h-0.5 w-5/6 bg-gray-300 rounded-full mb-2" />
    <div className="flex gap-1 border-t border-gray-200 pt-1">
      <div className="flex-1">
        <div className="h-1 w-10 bg-blue-900 rounded-sm mb-1" />
        <div className="h-0.5 w-12 bg-gray-400 rounded-sm" />
      </div>
      <div className="flex-1 border-l border-gray-200 pl-1">
        <div className="h-1 w-8 bg-blue-900 rounded-sm mb-1" />
        <div className="h-0.5 w-10 bg-gray-400 rounded-sm" />
      </div>
    </div>
  </div>
);

const PreviewCreative = () => (
  <div className="p-2 space-y-1 bg-white">
    <div className="p-1.5 bg-gradient-to-br from-purple-500 to-blue-500 rounded-md mb-2">
      <div className="h-0.5 w-8 bg-white/60 rounded-sm mb-1" />
      <div className="h-2 w-14 bg-white rounded-sm mb-1" />
      <div className="h-1 w-6 bg-white/80 rounded-full" />
    </div>
    <div className="h-0.5 w-full bg-gray-300 rounded-full" />
    <div className="h-0.5 w-4/5 bg-gray-300 rounded-full mb-2" />
    <div className="flex items-center gap-1 mb-0.5">
      <div className="h-1 w-1 rounded-full bg-black" />
      <div className="h-1.5 w-10 bg-black rounded-sm" />
    </div>
    <div className="flex items-center gap-1"><div className="h-0.5 w-1 bg-purple-500 rounded-sm"/><div className="h-0.5 w-14 bg-gray-300 rounded-full"/></div>
  </div>
);

const PreviewQwintsoft = () => (
  <div className="p-2 space-y-1 bg-white">
    <div className="h-1 w-8 bg-slate-800 rounded-sm mb-2" />
    <div className="h-1.5 w-16 bg-slate-700 rounded-sm mb-1" />
    <div className="h-1 w-20 bg-slate-400 rounded-sm" />
    <div className="h-1 w-16 bg-slate-400 rounded-sm mb-2" />
    <div className="h-1.5 w-24 bg-slate-700 rounded-sm mb-1" />
    <div className="h-1 w-16 bg-slate-400 rounded-sm" />
  </div>
);
