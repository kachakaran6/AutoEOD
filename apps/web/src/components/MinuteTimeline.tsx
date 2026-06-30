import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Trash2, Edit2, Download, Bot, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export function MinuteTimeline({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['timeline', date],
    queryFn: async () => {
      const res = await fetch(`/api/timeline?date=${date}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch timeline');
      return res.json();
    }
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/timeline/generate-summaries', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to generate summaries');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', date] });
      toast.success('AI Summaries generated');
    }
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', date] });
      setEditingId(null);
      toast.success('Session updated');
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/timeline/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to delete session');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', date] });
      toast.success('Session deleted');
    }
  });

  const handleExport = (formatType: string) => {
    // Basic export mockup
    const text = sessions.map((s: any) => 
      `${format(new Date(s.startTime), 'HH:mm')} - ${format(new Date(s.endTime), 'HH:mm')} | ${s.appName} | ${s.aiSummary || s.windowTitle}`
    ).join('\n');

    if (formatType === 'clipboard') {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } else {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeline-${date}.${formatType}`;
      a.click();
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border">
        <div>
          <h3 className="font-semibold">Minute-by-Minute Timeline</h3>
          <p className="text-sm text-muted-foreground">Detailed activity tracking from desktop and browser.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
            <Bot className="w-4 h-4 mr-2" /> Auto Summarize
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('txt')}>
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('clipboard')}>
            Copy
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border rounded-lg bg-card">
            No timeline data for this date.
          </div>
        ) : (
          sessions.map((s: any) => {
            const isEditing = editingId === s.id;
            return (
              <div key={s.id} className="p-4 bg-card rounded-lg border flex gap-4 items-start">
                <div className="text-sm font-medium whitespace-nowrap pt-1 w-32">
                  {format(new Date(s.startTime), 'HH:mm')} - {format(new Date(s.endTime), 'HH:mm')}
                </div>
                
                <div className="flex-1 space-y-1">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Window Title" className="h-8" />
                      <Input value={editSummary} onChange={e => setEditSummary(e.target.value)} placeholder="AI Summary" className="h-8" />
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => updateMut.mutate({ id: s.id, data: { windowTitle: editTitle, aiSummary: editSummary } })}>
                          <Save className="w-3 h-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {s.appName}
                        <span className="font-normal text-muted-foreground truncate">{s.windowTitle}</span>
                      </div>
                      <div className="text-sm text-muted-foreground border-l-2 pl-2 ml-1 mt-1 border-primary/50">
                        {s.aiSummary || <span className="italic">No summary generated</span>}
                      </div>
                    </>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex gap-1 opacity-50 hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(s.id); setEditTitle(s.windowTitle || ''); setEditSummary(s.aiSummary || ''); }}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => deleteMut.mutate(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
