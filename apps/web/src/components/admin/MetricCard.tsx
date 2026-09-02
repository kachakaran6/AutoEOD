// apps/web/src/components/admin/MetricCard.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: number; // positive = up, negative = down, 0 = same
  changeLabel?: string;
  invertChangeColor?: boolean; // if true, up is red, down is green (e.g. error rate, latency)
  icon?: React.ElementType;
  className?: string;
  statusColor?: 'emerald' | 'rose' | 'amber' | 'sky' | 'purple';
}

export function MetricCard({
  title,
  value,
  subtitle,
  change,
  changeLabel = 'vs yesterday',
  invertChangeColor = false,
  icon: Icon,
  className,
  statusColor,
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change !== undefined && change === 0;

  const isGood = invertChangeColor ? isNegative : isPositive;
  const isBad = invertChangeColor ? isPositive : isNegative;

  return (
    <Card className={cn('overflow-hidden border-border/60 bg-card/60 backdrop-blur-sm shadow-sm relative', className)}>
      {statusColor && (
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1',
            statusColor === 'emerald' && 'bg-emerald-500',
            statusColor === 'rose' && 'bg-rose-500',
            statusColor === 'amber' && 'bg-amber-500',
            statusColor === 'sky' && 'bg-sky-500',
            statusColor === 'purple' && 'bg-purple-500'
          )}
        />
      )}
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
        </div>

        {(change !== undefined || subtitle) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs">
            {change !== undefined && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-medium text-[11px]',
                  isGood && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                  isBad && 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                  isNeutral && 'bg-muted text-muted-foreground'
                )}
              >
                {isPositive && <TrendingUp className="h-3 w-3" />}
                {isNegative && <TrendingDown className="h-3 w-3" />}
                {isNeutral && <Minus className="h-3 w-3" />}
                {change > 0 ? `+${change}` : change}
              </span>
            )}
            <span className="text-muted-foreground truncate">{subtitle || changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
