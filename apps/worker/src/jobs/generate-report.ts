// apps/worker/src/jobs/generate-report.ts
// AI report generation job using OpenAI structured output + Zod validation

import OpenAI from 'openai';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { prisma } from '@autoeod/db';
import { logger } from '../lib/logger';
import { recordAuditLog } from '../lib/audit';
import { sendReminderEmail } from '../lib/email';
import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis';

const sendReportQueue = new Queue('send-report', { connection: redisConnection as any });

// Lazy OpenAI client
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    const isOR = baseURL?.includes('openrouter.ai');
    _openai = new OpenAI({ 
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      ...(isOR ? {
        defaultHeaders: {
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://autoeod.kachakaran.tech',
          'X-Title': 'AutoEOD',
        }
      } : {})
    });
  }
  return _openai;
}

// Zod schema for AI output validation
const ReportOutputSchema = z.object({
  summary: z.string().min(1).max(2000),
  completedItems: z.array(z.string()).max(100),
  inProgressItems: z.array(z.string()).max(100),
  blockers: z.string().nullable(),
  tomorrowPlan: z.string().max(1000),
});

type ReportOutput = z.infer<typeof ReportOutputSchema>;

// Model preference & fallback cascade
const PREFERRED_MODEL = process.env.OPENAI_MODEL || 'minimax/minimax-m3:free';

export function getModelCascade(): string[] {
  const models = [
    process.env.OPENAI_MODEL,
    process.env.OPENAI_FALLBACK_MODEL,
    'minimax/minimax-m3:free',
    'cohere/north-mini-code:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'poolside/laguna-xs-2.1:free',
    'nvidia/nemotron-3.5-lightning:free',
    'openrouter/free',
  ].filter(Boolean) as string[];
  return [...new Set(models)];
}


function buildPrompt(
  events: Array<{ source: string; type: string; title: string; repo: string; url: string; occurredAt: Date; rawPayload: any }>,
  settings: { reportTemplate: string; reportLanguage: string; workStartTime: string; workEndTime: string },
  reportDate: string
): string {
  const toneMap: Record<string, string> = {
    professional: 'formal business professional — suitable for a manager',
    minimalist: 'brief and terse — highly focused on the core facts, short sentences',
    modern: 'clear, approachable, and well-structured professional tone',
    executive: 'highly formal, dense, and objective executive summary tone',
    creative: 'friendly, modern, and engaging tone for a startup team',
  };
  const tone = toneMap[settings.reportTemplate] || toneMap.professional;

  const langMap: Record<string, string> = {
    english: 'English',
    hindi: 'Hindi',
    gujarati: 'Gujarati',
  };
  const language = langMap[settings.reportLanguage] || 'English';

  let eventsText =
    events.length === 0
      ? 'No activity was recorded today.'
      : events
          .map((e, i) => {
            // Highly compressed format to save tokens while keeping ALL events
            const time = DateTime.fromJSDate(e.occurredAt).toFormat('HH:mm');
            let desc = `[${time}] ${e.source.toUpperCase()}: ${e.title}`;
            
            if (e.repo) desc += ` (Repo: ${e.repo})`;
            if (e.source === 'github') desc += ` (URL: ${e.url})`;

            if (e.source === 'chatgpt' && e.rawPayload?.messages) {
              const msgs = e.rawPayload.messages.slice(-2); // Only last 2
              const excerpts = msgs.map((m: any) => `${m.role}: ${m.excerpt?.substring(0, 80) || ''}`).join(' | ');
              desc += `\n  -> ${excerpts}`;
            } else if (e.source === 'browser' && e.rawPayload?.durationSeconds) {
              const mins = Math.floor(e.rawPayload.durationSeconds / 60);
              const secs = e.rawPayload.durationSeconds % 60;
              if (mins > 0 || secs > 30) desc += ` (${mins}m ${secs}s)`;
            }
            return desc;
          })
          .join('\n');

  // We still keep a safety net, but increased to 40,000 chars since it's denser
  if (eventsText.length > 40000) {
    eventsText = eventsText.substring(0, 40000) + '\n\n...[TRUNCATED]...';
  }

  return `You are an AI assistant that drafts daily EOD (End-of-Day) work reports on behalf of a software engineer.

Today's date: ${reportDate}
Work hours: ${settings.workStartTime} to ${settings.workEndTime}
Tone: ${tone}
Language: Write ALL output fields in ${language}

Below is the complete list of activity recorded for my work today:

${eventsText}

Instructions:
1. Write the report from the FIRST-PERSON perspective ("I", "my"). It should read exactly like an email I am writing to my manager. Do NOT use third-person ("the engineer worked on...").
2. Use ONLY the events listed above as your source of truth. Do NOT invent commits, PRs, or work that is not listed.
3. Group related events into human-readable accomplishments (e.g., multiple commits toward one PR → one bullet).
4. Distinguish "completed" (merged PRs, closed issues, completed commits) from "in progress" (open PRs, recent commits without a merge).
5. Some activity entries are from ChatGPT conversations or general browser activity (source: 'chatgpt' or 'browser'). Use conversation titles, page titles, and snippets to understand what topics or problems I was researching/debugging. Frame them as my research/exploration.
6. The "summary" field should be 2-3 natural sentences (or 1-2 if tone is "short") summarizing my day's work.
7. Leave "blockers" as null if nothing in the events suggests a blocker. Never invent a blocker.
8. Write "tomorrowPlan" as a reasonable inference from open/in-progress items. Frame it as what I plan to do tomorrow.
9. If no activity was recorded, set summary to "No tracked activity today." and leave completedItems and inProgressItems empty.

Return a JSON object with exactly this structure:
{
  "summary": "string — 2-3 sentences summarizing my day",
  "completedItems": ["string", ...],
  "inProgressItems": ["string", ...],
  "blockers": "string or null",
  "tomorrowPlan": "string — what I plan to do tomorrow"
}`;
}

async function callOpenAI(prompt: string, model: string): Promise<ReportOutput> {
  const openai = getOpenAI();
  let response: any;

  try {
    response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    });
  } catch (err: any) {
    logger.warn({ model, err: err?.message }, 'Chat completion call error, retrying simple format');
    response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 2000,
    });
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) throw new Error(`Empty response from model ${model}`);

  let text = content.trim();

  // Strip markdown code fences
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  // Strip <think>...</think> blocks (some reasoning models)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Strip common reasoning model preamble patterns BEFORE extracting JSON.
  // Models like nvidia/nemotron output "Here's a thinking process:" or
  // "Here's my reasoning:" etc. before the actual JSON object.
  text = text.replace(/^(?:[\s\S]*?)(?=\{)/m, (match: string) => {
    // Only strip if the match looks like a preamble (not starting with '{' itself)
    if (!match.startsWith('{')) return '';
    return match;
  });

  let parsed: any;

  // Strategy: always try to find the outermost JSON object first.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try {
      parsed = JSON.parse(candidate);
    } catch {
      // Try sanitizing trailing commas before closing braces/brackets
      try {
        const sanitized = candidate.replace(/,\s*([\]}])/g, '$1');
        parsed = JSON.parse(sanitized);
      } catch {
        // Fall through to full-text parse attempt
      }
    }
  }

  if (!parsed) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Model ${model} output could not be parsed as JSON: ${content.substring(0, 300)}`);
    }
  }

  // Gracefully normalize output with defaults if partial fields are missing
  const normalized = {
    summary: typeof parsed.summary === 'string' && parsed.summary.trim().length > 0 ? parsed.summary.trim() : 'Completed daily activities and tasks.',
    completedItems: Array.isArray(parsed.completedItems) ? parsed.completedItems.map(String).filter((s: string) => s.trim().length > 0) : [],
    inProgressItems: Array.isArray(parsed.inProgressItems) ? parsed.inProgressItems.map(String).filter((s: string) => s.trim().length > 0) : [],
    blockers: parsed.blockers && typeof parsed.blockers === 'string' && parsed.blockers.toLowerCase() !== 'null' && parsed.blockers.toLowerCase() !== 'none' ? parsed.blockers.trim() : null,
    tomorrowPlan: typeof parsed.tomorrowPlan === 'string' ? parsed.tomorrowPlan.trim() : 'Continue progress on open tasks.',
  };

  const validated = ReportOutputSchema.safeParse(normalized);
  if (!validated.success) {
    throw new Error(`Model ${model} output validation failed: ${JSON.stringify(validated.error.flatten())}`);
  }

  return validated.data;
}

export interface GenerateReportJobData {
  userId: string;
  reportDate: string;
  manual?: boolean;
  reportId?: string;
}

export async function generateReport(data: GenerateReportJobData): Promise<void> {
  const { userId, reportDate } = data;

  logger.info({ userId, reportDate }, 'Starting report generation');

  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings) {
    throw new Error(`No settings found for user ${userId}`);
  }

  const tz = settings.timezone;
  const dayStart = DateTime.fromISO(reportDate, { zone: tz }).set({
    hour: parseInt(settings.workStartTime.split(':')[0]),
    minute: parseInt(settings.workStartTime.split(':')[1]),
    second: 0,
  });
  const dayEnd = DateTime.fromISO(reportDate, { zone: tz }).set({
    hour: parseInt(settings.workEndTime.split(':')[0]),
    minute: parseInt(settings.workEndTime.split(':')[1]),
    second: 59,
  });

  const events: any[] = await prisma.activityEvent.findMany({
    where: {
      userId,
      occurredAt: {
        gte: dayStart.toJSDate(),
        lte: dayEnd.toJSDate(),
      },
    },
    orderBy: { occurredAt: 'asc' },
    select: { id: true, source: true, type: true, title: true, repo: true, url: true, occurredAt: true, rawPayload: true },
  });

  if ((settings as any).includeRadarLogs) {
    const radarLogs = await prisma.browserActivityLog.findMany({
      where: {
        userId,
        tabOpenedAt: {
          gte: dayStart.toJSDate(),
          lte: dayEnd.toJSDate(),
        },
        promotedToEventId: null, // Only unpromoted ones to prevent double-counting
      },
    });

    const domainStats = new Map<string, { duration: number; title: string; count: number }>();
    for (const log of radarLogs) {
      const current = domainStats.get(log.domain) || { duration: 0, title: log.pageTitle, count: 0 };
      domainStats.set(log.domain, {
        duration: current.duration + log.durationSeconds,
        title: log.pageTitle || current.title,
        count: current.count + 1,
      });
    }

    for (const [domain, stats] of domainStats.entries()) {
      if (stats.duration < 60) continue; // Skip noise under 1 minute

      const durationMins = Math.floor(stats.duration / 60);
      const durationSecs = stats.duration % 60;
      
      events.push({
        id: `radar-summary-${domain}`,
        source: 'browser',
        type: 'radar_summary',
        title: `Browsed ${domain} (${durationMins}m ${durationSecs}s, ${stats.count} visits) - e.g. ${stats.title}`,
        repo: '',
        url: `https://${domain}`,
        occurredAt: dayEnd.toJSDate(),
        rawPayload: { durationSeconds: stats.duration, count: stats.count },
      });
    }
  }

  logger.info({ userId, reportDate, eventCount: events.length }, 'Events fetched for report');

  const prompt = buildPrompt(
    events.map((e) => ({ ...e, occurredAt: e.occurredAt })),
    {
      reportTemplate: settings.reportTemplate,
      reportLanguage: settings.reportLanguage,
      workStartTime: settings.workStartTime,
      workEndTime: settings.workEndTime,
    },
    reportDate
  );

  // Execute AI generation with multi-model fallback cascade
  const modelCascade = getModelCascade();
  const primaryModel = modelCascade[0] || PREFERRED_MODEL;
  let reportOutput: ReportOutput | null = null;
  let usedModel = primaryModel;
  let lastError: any = null;
  const startTime = Date.now();

  for (let i = 0; i < modelCascade.length; i++) {
    const currentModel = modelCascade[i];
    try {
      logger.info({ userId, reportDate, model: currentModel, attempt: i + 1, totalCascadeModels: modelCascade.length }, 'Attempting report generation with model');
      reportOutput = await callOpenAI(prompt, currentModel);
      usedModel = currentModel;

      if (i > 0) {
        logger.info({ userId, reportDate, primaryModel, usedModel, attempt: i + 1 }, 'AI model fallback succeeded');
        await recordAuditLog({
          action: 'AI_MODEL_FALLBACK_TRIGGERED',
          userId,
          level: 'warn',
          details: {
            primaryModel,
            fallbackModel: usedModel,
            attempt: i + 1,
            recoveredFromError: lastError instanceof Error ? lastError.message : String(lastError),
          },
        });
      }
      break;
    } catch (err: any) {
      lastError = err;
      logger.warn({ err: err?.message, userId, reportDate, model: currentModel, attempt: i + 1 }, 'Model failed in cascade, attempting next fallback');
    }
  }

  if (!reportOutput) {
    logger.error({ lastError, userId, reportDate }, 'All AI models in fallback cascade failed, marking report as failed');
    
    await recordAuditLog({
      action: 'AI_REPORT_FAILED',
      userId,
      level: 'error',
      details: {
        reportDate,
        attemptedModels: modelCascade,
        error: lastError instanceof Error ? lastError.message : 'All AI models failed',
        eventsCount: events.length,
      },
    });

    await prisma.report.upsert({
      where: { userId_reportDate: { userId, reportDate } },
      create: {
        userId,
        reportDate,
        status: 'failed',
        rawEventIds: events.map((e) => e.id),
        errorMessage: lastError instanceof Error ? lastError.message : 'OpenAI generation failed',
      },
      update: {
        status: 'failed',
        errorMessage: lastError instanceof Error ? lastError.message : 'OpenAI generation failed',
        rawEventIds: events.map((e) => e.id),
      },
    });

    // Create failure notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'report_failed',
        title: 'Report generation failed',
        message: `Your EOD report for ${reportDate} could not be generated. Error: ${lastError instanceof Error ? lastError.message : 'Unknown'}. Please try again.`,
        reportId: undefined,
      },
    });
    return;
  }

  const durationMs = Date.now() - startTime;

  // Upsert the report
  const report = await prisma.report.upsert({
    where: { userId_reportDate: { userId, reportDate } },
    create: {
      userId,
      reportDate,
      status: 'draft',
      summary: reportOutput.summary,
      completedItems: reportOutput.completedItems,
      inProgressItems: reportOutput.inProgressItems,
      blockers: reportOutput.blockers,
      tomorrowPlan: reportOutput.tomorrowPlan,
      rawEventIds: events.map((e) => e.id),
      aiModel: usedModel,
      generatedAt: new Date(),
    },
    update: {
      status: 'draft',
      summary: reportOutput.summary,
      completedItems: reportOutput.completedItems,
      inProgressItems: reportOutput.inProgressItems,
      blockers: reportOutput.blockers,
      tomorrowPlan: reportOutput.tomorrowPlan,
      rawEventIds: events.map((e) => e.id),
      aiModel: usedModel,
      generatedAt: new Date(),
      errorMessage: null,
    },
  });

  // Record successful audit log
  await recordAuditLog({
    action: 'AI_REPORT_GENERATED',
    userId,
    level: 'info',
    details: {
      reportDate,
      model: usedModel,
      durationMs,
      completedCount: reportOutput.completedItems.length,
      inProgressCount: reportOutput.inProgressItems.length,
      eventsCount: events.length,
    },
  });

  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'report_ready',
      title: 'Your EOD report is ready',
      message: `Your report for ${reportDate} has been generated. Review and send it to your manager.`,
      reportId: report.id,
    },
  });

  if (settings.autoSend) {
    // Schedule the send-report job to run EXACTLY at reportTime
    const nowTz = DateTime.now().setZone(tz);
    const [rH, rM] = settings.reportTime.split(':').map(Number);
    let targetTime = DateTime.fromObject({ hour: rH, minute: rM, second: 0 }, { zone: tz });
    
    // If we somehow generated this after the target time today, schedule for immediately (or next day)
    if (nowTz > targetTime) {
      targetTime = targetTime.plus({ days: 1 }); // Or just run immediately if it's the same day, but typically it shouldn't happen.
      // Actually, if we are just a minute late, we should just send immediately.
      if (nowTz.diff(targetTime, 'minutes').minutes < 60) {
        targetTime = nowTz;
      }
    }

    const delay = Math.max(0, targetTime.toMillis() - nowTz.toMillis());
    
    await sendReportQueue.add(
      'send-report',
      { userId, reportId: report.id },
      { delay, jobId: `send-${report.id}-${Date.now()}` }
    );
    
    logger.info({ userId, reportId: report.id, delay }, 'Enqueued auto-send job');
  } else {
    // Stretch goal: send email reminder for review
    try {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        await sendReminderEmail(userId, user.email, reportDate, `${frontendUrl}/reports/${reportDate}`);
        logger.info({ userId, reportDate }, 'Email reminder sent');
      }
    } catch (emailErr) {
      // Non-fatal — log but don't fail the job
      logger.warn({ emailErr, userId }, 'Failed to send email reminder (non-fatal)');
    }
  }

  logger.info({ userId, reportDate, reportId: report.id, model: usedModel }, 'Report generated successfully');
}
