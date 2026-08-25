import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Calendar as CalendarIcon, Info, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

// API helpers
const fetchHolidays = async () => {
  const res = await fetch('/api/holidays', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
  if (!res.ok) throw new Error('Failed to fetch holidays');
  return res.json();
};
const addHoliday = async (data: { date: string, name: string }) => {
  const res = await fetch('/api/holidays', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to add holiday');
  return res.json();
};
const deleteHoliday = async (id: string) => {
  const res = await fetch(`/api/holidays/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Failed to delete holiday');
  return res.json();
};
const fetchSkipLogs = async () => {
  const res = await fetch('/api/holidays/skip-logs', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
  if (!res.ok) throw new Error('Failed to fetch skip logs');
  return res.json();
};

const DAYS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 7, label: 'Sunday' },
];

export function WorkingSchedule({ workingDays = [1,2,3,4,5], onChange }: { workingDays?: number[], onChange: (days: number[]) => void }) {
  const queryClient = useQueryClient();
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  const { data: holidays = [] } = useQuery({ queryKey: ['holidays'], queryFn: fetchHolidays });
  const { data: skipLogs = [] } = useQuery({ queryKey: ['skipLogs'], queryFn: fetchSkipLogs });

  const addMut = useMutation({
    mutationFn: addHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setNewHolidayName('');
      setNewHolidayDate('');
      toast.success('Holiday added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday removed');
    },
  });

  const toggleDay = (id: number) => {
    if (workingDays.includes(id)) {
      onChange(workingDays.filter(d => d !== id));
    } else {
      onChange([...workingDays, id].sort());
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Working Days Schedule
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Select the days you typically work. Automated EOD reports will only generate on active days.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2.5">
            {DAYS.map((day) => {
              const isActive = workingDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
                    isActive
                      ? 'bg-primary/15 text-primary border-primary/40 shadow-xs'
                      : 'bg-card text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground'
                  }`}
                >
                  {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                  {day.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border/70 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary" />
            Holidays & PTO
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            Add specific dates to automatically skip report generation (e.g. public holidays, vacation).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-semibold">Date</Label>
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs font-semibold">Holiday Name / Reason</Label>
              <Input
                placeholder="e.g. New Year's Day, Vacation"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>
            <Button
              disabled={!newHolidayDate || !newHolidayName || addMut.isPending}
              onClick={() => addMut.mutate({ date: newHolidayDate, name: newHolidayName })}
              className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Add Date
            </Button>
          </div>

          {holidays.length > 0 && (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden mt-3 bg-muted/20">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 text-xs">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono font-semibold text-foreground">{h.date}</span>
                    <span className="text-muted-foreground font-medium">{h.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500 rounded-lg"
                    onClick={() => delMut.mutate(h.id)}
                    disabled={delMut.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {skipLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skip History</CardTitle>
            <CardDescription>Recent dates where report generation was automatically skipped.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {skipLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                  <Info className="h-4 w-4 mt-0.5" />
                  <div>
                    <div className="font-medium text-foreground">{log.date}</div>
                    <div>Skipped because: {log.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
