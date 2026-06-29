// apps/worker/src/jobs/generate-report.ts
// AI report generation job using OpenAI structured output + Zod validation

import OpenAI from 'openai';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { prisma } from '@autoeod/db';
import { logger } from '../lib/logger';
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
    _openai = new OpenAI({ 
      apiKey,
      ...(baseURL ? { baseURL } : {})
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

// Model preference — use gpt-4o-mini or fall back gracefully
const PREFERRED_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(content);
  const validated = ReportOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`OpenAI output validation failed: ${JSON.stringify(validated.error.flatten())}`);
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

  // Try the preferred model; if it fails validation, retry with error-correction prompt
  let reportOutput: ReportOutput;
  let usedModel = PREFERRED_MODEL;

  try {
    reportOutput = await callOpenAI(prompt, PREFERRED_MODEL);
  } catch (firstErr) {
    logger.warn({ firstErr, userId, reportDate }, 'First OpenAI attempt failed, retrying with fallback model');
    try {
      // Try fallback model if provided, otherwise retry the same model
      usedModel = process.env.OPENAI_FALLBACK_MODEL || PREFERRED_MODEL;
      reportOutput = await callOpenAI(prompt, usedModel);
    } catch (secondErr) {
      logger.error({ secondErr, userId, reportDate }, 'Both OpenAI attempts failed, marking report as failed');
      await prisma.report.upsert({
        where: { userId_reportDate: { userId, reportDate } },
        create: {
          userId,
          reportDate,
          status: 'failed',
          rawEventIds: events.map((e) => e.id),
          errorMessage: secondErr instanceof Error ? secondErr.message : 'OpenAI generation failed',
        },
        update: {
          status: 'failed',
          errorMessage: secondErr instanceof Error ? secondErr.message : 'OpenAI generation failed',
          rawEventIds: events.map((e) => e.id),
        },
      });

      // Create failure notification
      await prisma.notification.create({
        data: {
          userId,
          type: 'report_failed',
          title: 'Report generation failed',
          message: `Your EOD report for ${reportDate} could not be generated. Error: ${secondErr instanceof Error ? secondErr.message : 'Unknown'}. Please try again.`,
          reportId: undefined,
        },
      });
      return;
    }
  }

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
