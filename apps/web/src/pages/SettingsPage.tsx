// apps/web/src/pages/SettingsPage.tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Loader2, Info } from 'lucide-react'
import { settings as settingsApi } from '@/lib/api'
import type { UserSettings } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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

  const [form, setForm] = useState<Partial<UserSettings>>({})
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data)
      setIsDirty(false)
    }
  }, [data])

  const updateField = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess: () => {
      toast.success('Settings saved')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setIsDirty(false)
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
          disabled={!isDirty || saveMutation.isPending}
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
      {/* ChatGPT Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ChatGPT Integration</CardTitle>
          <CardDescription>Control what the browser extension captures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1 max-w-[80%]">
              <Label htmlFor="setting-chatgpt-capture" className="text-sm font-medium">Capture ChatGPT message content (not just titles)</Label>
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
