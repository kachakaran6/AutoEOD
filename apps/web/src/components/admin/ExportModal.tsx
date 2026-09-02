// apps/web/src/components/admin/ExportModal.tsx
import React, { useState } from 'react';
import { admin } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileSpreadsheet,
  FileCode2,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ExportModalProps {
  category: string;
  filters?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ category, filters, isOpen, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setLoading(true);
    setJobId(null);
    setDownloadUrl(null);

    try {
      const res = await admin.createExportJob({
        category,
        filters,
        format,
      });

      setJobId(res.jobId);
      toast.info('Export job queued. Generating file...');

      // Poll export job status
      const interval = setInterval(async () => {
        try {
          const statusRes = await admin.getExportStatus(res.jobId);
          if (statusRes.status === 'COMPLETED') {
            clearInterval(interval);
            setLoading(false);
            setDownloadUrl(statusRes.downloadUrl || null);
            setRowCount(statusRes.rowCount || null);
            toast.success('Export completed successfully!');
          } else if (statusRes.status === 'FAILED') {
            clearInterval(interval);
            setLoading(false);
            toast.error(statusRes.errorMessage || 'Export failed');
          }
        } catch {
          clearInterval(interval);
          setLoading(false);
        }
      }, 1500);
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message || 'Failed to start export');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Export Data</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export <span className="font-mono font-medium text-foreground">{category}</span> records
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!downloadUrl ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Choose Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat('csv')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    format === 'csv'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <FileSpreadsheet className="h-6 w-6" />
                  <span className="text-xs font-semibold">CSV Spreadsheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('json')}
                  className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    format === 'json'
                      ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/40 text-muted-foreground'
                  }`}
                >
                  <FileCode2 className="h-6 w-6" />
                  <span className="text-xs font-semibold">Structured JSON</span>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="font-mono font-medium text-foreground uppercase">{category}</span>
              </div>
              <div className="flex justify-between">
                <span>Security Policy:</span>
                <span className="text-emerald-500 font-medium">Automatic Redaction Applied</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleStartExport} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {loading ? 'Processing Export...' : 'Generate & Download'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-center py-2">
            <div className="h-12 w-12 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground">Export Ready!</h4>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {rowCount !== null ? `${rowCount} records processed` : 'File generated'}
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <a href={downloadUrl} download>
                <Button size="sm" className="gap-2">
                  <Download className="h-4 w-4" /> Download {format.toUpperCase()}
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
