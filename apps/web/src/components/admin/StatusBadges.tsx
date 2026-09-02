// apps/web/src/components/admin/StatusBadges.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldAlert,
  Activity,
  Zap,
} from 'lucide-react';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = status.toUpperCase();
  if (['OK', 'SUCCESS', 'HEALTHY', 'COMPLETED', 'RESOLVED', 'ACTIVE'].includes(s)) {
    return (
      <Badge className={cn('bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px] font-mono', className)}>
        <CheckCircle2 className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  if (['WARNING', 'DEGRADED', 'WAITING', 'DELAYED', 'QUEUED', 'PENDING', 'PROCESSING'].includes(s)) {
    return (
      <Badge className={cn('bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-mono', className)}>
        <Clock className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  if (['ERROR', 'FAILED', 'UNHEALTHY', 'DOWN', 'FAILURE', 'DENIED', 'UNRESOLVED', 'CRITICAL'].includes(s)) {
    return (
      <Badge className={cn('bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 gap-1 text-[11px] font-mono', className)}>
        <XCircle className="h-3 w-3" />
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn('text-[11px] font-mono text-muted-foreground', className)}>
      {status}
    </Badge>
  );
}

export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = severity.toUpperCase();
  if (s === 'CRITICAL') {
    return (
      <Badge className={cn('bg-rose-600 text-white font-bold border-rose-700 gap-1 text-[10px] animate-pulse', className)}>
        <ShieldAlert className="h-3 w-3" />
        CRITICAL
      </Badge>
    );
  }
  if (s === 'HIGH') {
    return (
      <Badge className={cn('bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/40 gap-1 text-[10px] font-semibold', className)}>
        <AlertTriangle className="h-3 w-3" />
        HIGH
      </Badge>
    );
  }
  if (s === 'MEDIUM' || s === 'WARNING') {
    return (
      <Badge className={cn('bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[10px]', className)}>
        MEDIUM
      </Badge>
    );
  }
  return (
    <Badge className={cn('bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 gap-1 text-[10px]', className)}>
      LOW
    </Badge>
  );
}

export function LevelBadge({ level, className }: { level: string; className?: string }) {
  const l = level.toLowerCase();
  if (l === 'error' || l === 'fatal') {
    return (
      <Badge className={cn('bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-mono uppercase', className)}>
        {level}
      </Badge>
    );
  }
  if (l === 'warn' || l === 'warning') {
    return (
      <Badge className={cn('bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono uppercase', className)}>
        {level}
      </Badge>
    );
  }
  if (l === 'info') {
    return (
      <Badge className={cn('bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30 text-[10px] font-mono uppercase', className)}>
        {level}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn('text-muted-foreground text-[10px] font-mono uppercase', className)}>
      {level}
    </Badge>
  );
}

export function HealthBadge({ status, latencyMs }: { status: string; latencyMs?: number }) {
  const isHealthy = status === 'healthy';
  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border',
      isHealthy
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
    )}>
      <span className={cn('h-2 w-2 rounded-full', isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500')} />
      <span className="capitalize">{status}</span>
      {latencyMs !== undefined && (
        <span className="text-[10px] opacity-75 font-mono">({latencyMs}ms)</span>
      )}
    </div>
  );
}
