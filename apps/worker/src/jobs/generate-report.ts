// apps/worker/src/jobs/generate-report.ts
// AI report generation job using OpenAI structured output + Zod validation

import OpenAI from 'openai';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { prisma } from '@autoeod/db';
import { logger } from '../lib/logger';
import { sendReminderEmail } from '../lib/email';

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
  completedItems: z.array(z.string()).max(20),
  inProgressItems: z.array(z.string()).max(20),
  blockers: z.string().nullable(),
  tomorrowPlan: z.string().max(1000),
});

type ReportOutput = z.infer<typeof ReportOutputSchema>;

// Model preference — use gpt-4.1 or fall back gracefully
const PREFERRED_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';

function buildPrompt(
  events: Array<{ source: string; type: string; title: string; repo: string; url: string; occurredAt: Date; rawPayload: any }>,
  settings: { reportTemplate: string; reportLanguage: string; workStartTime: string; workEndTime: string },
  reportDate: string
): string {
  const toneMap: Record<string, string> = {
    professional: 'formal business professional — suitable for a manager',
    short: 'brief and terse — 1-2 sentences for summary, bullet points only',
    detailed: 'detailed and granular — include repo names, file paths where relevant, more complete bullet points',
  };
  const tone = toneMap[settings.reportTemplate] || toneMap.professional;

  const langMap: Record<string, string> = {
    english: 'English',
    hindi: 'Hindi',
    gujarati: 'Gujarati',
  };
  const language = langMap[settings.reportLanguage] || 'English';

  const eventsText =
    events.length === 0
      ? 'No activity was recorded today.'
      : events
          .map((e, i) => {
            let desc = `${i + 1}. [${e.source.toUpperCase()}: ${e.type.toUpperCase()}] ${e.title} — repo: ${e.repo || 'N/A'} — at ${DateTime.fromJSDate(e.occurredAt).toFormat('HH:mm')} — ${e.url}`;
            if (e.source === 'chatgpt' && e.rawPayload?.messages) {
              const excerpts = e.rawPayload.messages.map((m: any) => `${m.role}: ${m.excerpt}`).join('\n');
              desc += `\n   Excerpts:\n   ${excerpts}`;
            }
            return desc;
          })
          .join('\n\n');

  return `You are an AI assistant that generates daily EOD (End-of-Day) work reports for software engineers.

Today's date: ${reportDate}
Work hours: ${settings.workStartTime} to ${settings.workEndTime}
Tone: ${tone}
Language: Write ALL output fields in ${language}

Below is the complete list of activity recorded for this engineer today:

${eventsText}

Instructions:
1. Use ONLY the events listed above as your source of truth. Do NOT invent commits, PRs, or work that is not listed.
2. Group related events into human-readable accomplishments (e.g., multiple commits toward one PR → one bullet).
3. Distinguish "completed" (merged PRs, closed issues, completed commits) from "in progress" (open PRs, recent commits without a merge).
4. Some activity entries are from ChatGPT conversations, identified by source: 'chatgpt'. Use conversation titles (and message excerpts, if present) to understand what topics or problems the user was working on — but never claim a ChatGPT conversation alone constitutes 'completed work.' Frame ChatGPT activity as research/exploration/debugging assistance, not as a deliverable in itself, unless the GitHub activity for the same time period corroborates an actual completed change.
5. The "summary" field should be 2-3 natural sentences (or 1-2 if tone is "short") summarizing the day's work.
6. Leave "blockers" as null if nothing in the events suggests a blocker. Never invent a blocker.
7. Write "tomorrowPlan" as a reasonable inference from open/in-progress items. Frame it as a suggestion, not a fact.
8. If no activity was recorded, set summary to "No tracked activity today." and leave completedItems and inProgressItems empty.

Return a JSON object with exactly this structure:
{
  "summary": "string — 2-3 sentences summarizing the day",
  "completedItems": ["string", ...],
  "inProgressItems": ["string", ...],
  "blockers": "string or null",
  "tomorrowPlan": "string — plan for tomorrow based on open work"
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

  // Fetch activity events for this work day
  const events = await prisma.activityEvent.findMany({
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
          message: `Your EOD report for ${reportDate} could not be generated. Please try again.`,
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

  // Stretch goal: send email reminder
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user && process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your-resend-api-key-here') {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      await sendReminderEmail(user.email, reportDate, `${frontendUrl}/reports/${reportDate}`);
      logger.info({ userId, reportDate }, 'Email reminder sent');
    }
  } catch (emailErr) {
    // Non-fatal — log but don't fail the job
    logger.warn({ emailErr, userId }, 'Failed to send email reminder (non-fatal)');
  }

  logger.info({ userId, reportDate, reportId: report.id, model: usedModel }, 'Report generated successfully');
}
