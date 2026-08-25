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
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Working Days Schedule
          </CardTitle>
          <CardDescription className="text-xs">
            Select the days you typically work. Automated EOD reports will only generate on active days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2.5">
            {DAYS.map((day) => {
              const isActive = workingDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-150 border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25 scale-[1.02]'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {isActive && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                  {day.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holidays</CardTitle>
          <CardDescription>Add specific dates to skip report generation (e.g., public holidays, personal time off).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label>Date</Label>
              <Input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Name</Label>
              <Input placeholder="e.g. New Year's Day" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} />
            </div>
            <Button disabled={!newHolidayDate || !newHolidayName || addMut.isPending} onClick={() => addMut.mutate({ date: newHolidayDate, name: newHolidayName })}>
              <Plus className="h-4 w-4 mr-2" /> Add
            </Button>
          </div>

          {holidays.length > 0 && (
            <div className="rounded-md border mt-4">
              {holidays.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{h.date}</span>
                    <span className="text-muted-foreground">{h.name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => delMut.mutate(h.id)} disabled={delMut.isPending}>
                    <Trash2 className="h-4 w-4 text-red-500" />
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
