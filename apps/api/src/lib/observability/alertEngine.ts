// apps/api/src/lib/observability/alertEngine.ts
// Threshold-based alert evaluation engine

import { prisma } from '@autoeod/db';
import { metricsEngine } from './metrics';

export class AlertEngine {
  /**
   * Evaluates all active AlertRules against current telemetry snapshot
   */
  public static async evaluateRules(): Promise<void> {
    try {
      const activeRules = await prisma.alertRule.findMany({
        where: { enabled: true },
      });

      if (activeRules.length === 0) return;

      const snapshot = metricsEngine.getSnapshot();

      for (const rule of activeRules) {
        let currentValue = 0;

        switch (rule.metric) {
          case '5xx_rate':
            currentValue = snapshot.requests.failure5xxRate;
            break;
          case 'error_rate':
            currentValue = snapshot.requests.errorRate;
            break;
          case 'avg_latency':
            currentValue = snapshot.latency.avg;
            break;
          case 'p95_latency':
            currentValue = snapshot.latency.p95;
            break;
          case 'ai_fallback_rate':
            currentValue = snapshot.ai.fallbackRate;
            break;
          default:
            continue;
        }

        let isTriggered = false;
        if (rule.condition === 'gt' && currentValue > rule.threshold) {
          isTriggered = true;
        } else if (rule.condition === 'lt' && currentValue < rule.threshold) {
          isTriggered = true;
        } else if (rule.condition === 'eq' && currentValue === rule.threshold) {
          isTriggered = true;
        }

        if (isTriggered) {
          // Check if there is already an unresolved active incident for this rule
          const existingIncident = await prisma.alertIncident.findFirst({
            where: { ruleId: rule.id, status: 'TRIGGERED' },
          });

          if (!existingIncident) {
            await prisma.alertIncident.create({
              data: {
                ruleId: rule.id,
                status: 'TRIGGERED',
                metricValue: currentValue,
                message: `Alert "${rule.name}" triggered: ${rule.metric} is ${currentValue} (threshold: ${rule.condition} ${rule.threshold})`,
                details: {
                  metric: rule.metric,
                  currentValue,
                  threshold: rule.threshold,
                  severity: rule.severity,
                },
              },
            });
          }
        }
      }
    } catch (err) {
      console.error('AlertEngine evaluateRules error (fail-safe):', err);
    }
  }
}
