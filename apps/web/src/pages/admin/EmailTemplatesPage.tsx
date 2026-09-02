// apps/web/src/pages/admin/EmailTemplatesPage.tsx
import React, { useState, useEffect } from 'react';
import { admin, EmailTemplate } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FileCode,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Edit2,
  Code2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await admin.getTemplates();
      setTemplates(data);
    } catch {
      toast.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    setSaving(true);
    try {
      if (editingTemplate.id) {
        await admin.updateTemplate(editingTemplate.id, editingTemplate);
        toast.success('Template updated successfully');
      } else {
        await admin.createTemplate(editingTemplate);
        toast.success('Template created successfully');
      }
      setEditingTemplate(null);
      setIsCreating(false);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await admin.deleteTemplate(id);
      toast.success('Template deleted');
      fetchTemplates();
    } catch {
      toast.error('Failed to delete template');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FileCode className="h-6 w-6 text-primary" /> Email Templates & Delivery Design
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure automated daily EOD reports, notification headers, variable tags, and HTML body layouts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsCreating(true);
              setEditingTemplate({ key: '', name: '', subject: '', bodyHtml: '', enabled: true });
            }}
            className="text-xs h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create Template
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={fetchTemplates}
            disabled={loading}
            className="text-xs h-8 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Editor Form Modal / Card */}
      {(isCreating || editingTemplate) && (
        <Card className="border-primary/40 bg-card shadow-lg animate-in slide-in-from-top-2">
          <CardHeader>
            <CardTitle className="text-sm font-bold">
              {editingTemplate?.id ? 'Edit Email Template' : 'Create New Email Template'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Template Key (e.g. eod_daily_summary)</Label>
                  <Input
                    type="text"
                    value={editingTemplate?.key || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate!, key: e.target.value })}
                    className="h-9 text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Template Name</Label>
                  <Input
                    type="text"
                    value={editingTemplate?.name || ''}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate!, name: e.target.value })}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subject Line (supports {'{{variables}}'})</Label>
                <Input
                  type="text"
                  value={editingTemplate?.subject || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate!, subject: e.target.value })}
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Body HTML</Label>
                <textarea
                  rows={8}
                  value={editingTemplate?.bodyHtml || ''}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate!, bodyHtml: e.target.value })}
                  className="w-full p-3 rounded-lg border border-border bg-muted/20 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(null);
                    setIsCreating(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> Save Template
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tpl) => (
          <Card key={tpl.id} className="border-border/60 bg-card/60 backdrop-blur-sm flex flex-col justify-between">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">{tpl.name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">key: {tpl.key}</p>
                </div>
                <Badge variant={tpl.enabled ? 'default' : 'secondary'} className="text-[10px]">
                  {tpl.enabled ? 'ENABLED' : 'DISABLED'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3 text-xs flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Subject:</span>
                  <span className="font-mono text-foreground font-semibold">{tpl.subject}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">HTML Preview:</span>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/60 font-mono text-[11px] text-muted-foreground line-clamp-3">
                    {tpl.bodyHtml}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => {
                    setEditingTemplate(tpl);
                    setIsCreating(false);
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs gap-1 text-rose-500 hover:text-rose-600"
                  onClick={() => handleDelete(tpl.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
