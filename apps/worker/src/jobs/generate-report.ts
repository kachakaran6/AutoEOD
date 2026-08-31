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
const TimeBlockSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  title: z.string(),
  category: z.string().default('work'),
  details: z.string().default(''),
  toolsAndWebsites: z.array(z.string()).default([]),
});

export type TimeBlock = z.infer<typeof TimeBlockSchema>;

const ReportOutputSchema = z.object({
  summary: z.string().min(1).max(2000),
  completedItems: z.array(z.string()).max(100),
  inProgressItems: z.array(z.string()).max(100),
  blockers: z.string().nullable(),
  tomorrowPlan: z.string().max(1000),
  timeBlocks: z.array(TimeBlockSchema).optional().nullable(),
});

type ReportOutput = z.infer<typeof ReportOutputSchema>;

// Model preference & fallback cascade
const PREFERRED_MODEL = process.env.OPENAI_MODEL || 'minimax/minimax-m3:free';

export function getModelCascade(): string[] {
  const models = [
    process.env.OPENAI_MODEL,
    'minimax/minimax-m3:free',
    'minimax/minimax-m2.7:free',
    'openrouter/free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3.5-lightning:free',
    'z-ai/glm-5.2:free',
    'cohere/north-mini-code:free',
    process.env.OPENAI_FALLBACK_MODEL,
  ].filter(Boolean) as string[];
  return [...new Set(models)];
}

function repairAndParseJson(raw: string): any {
  let text = raw.trim();

  // Strip markdown code fences
  text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*(?:```|$)/gi, '$1').trim();

  // Strip <think>...</think> blocks
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // Strip common reasoning preamble before first {
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    text = text.substring(firstBrace);
  }

  // 1. Try standard parse
  try {
    return JSON.parse(text);
  } catch {}

  // 2. Try sanitize trailing commas
  try {
    const sanitized = text.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(sanitized);
  } catch {}

  // 3. Try balancing unclosed strings, arrays, and objects
  try {
    let balanced = text;
    // Check if inside open string
    let inString = false;
    let escaped = false;
    for (let i = 0; i < balanced.length; i++) {
      const ch = balanced[i];
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = !inString;
      }
    }
    if (inString) {
      balanced += '"';
    }

    // Count open { and [
    let openBraces = 0;
    let openBrackets = 0;
    inString = false;
    escaped = false;
    for (let i = 0; i < balanced.length; i++) {
      const ch = balanced[i];
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = !inString;
      } else if (!inString) {
        if (ch === '{') openBraces++;
        else if (ch === '}') openBraces = Math.max(0, openBraces - 1);
        else if (ch === '[') openBrackets++;
        else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
      }
    }

    // Append closing brackets and braces
    while (openBrackets > 0) {
      balanced += ']';
      openBrackets--;
    }
    while (openBraces > 0) {
      balanced += '}';
      openBraces--;
    }

    // Sanitize trailing commas again
    balanced = balanced.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(balanced);
  } catch {}

  // 4. Fallback regex extraction of fields from truncated outputs
  const extracted: any = {};
  const summaryMatch = text.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (summaryMatch) {
    extracted.summary = summaryMatch[1].replace(/\\"/g, '"');
  }

  const completedMatch = text.match(/"completedItems"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (completedMatch) {
    const items = [...completedMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
    if (items.length > 0) extracted.completedItems = items;
  }

  const inProgressMatch = text.match(/"inProgressItems"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
  if (inProgressMatch) {
    const items = [...inProgressMatch[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
    if (items.length > 0) extracted.inProgressItems = items;
  }

  const tomorrowMatch = text.match(/"tomorrowPlan"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (tomorrowMatch) {
    extracted.tomorrowPlan = tomorrowMatch[1].replace(/\\"/g, '"');
  }

  const blockersMatch = text.match(/"blockers"\s*:\s*(?:"((?:[^"\\]|\\.)*)"|null)/);
  if (blockersMatch) {
    extracted.blockers = blockersMatch[1] ? blockersMatch[1].replace(/\\"/g, '"') : null;
  }

  // Extract any completed timeBlocks
  const timeBlocksMatch = text.match(/"timeBlocks"\s*:\s*\[([\s\S]*)/);
  if (timeBlocksMatch) {
    const blocks: any[] = [];
    const blockMatches = timeBlocksMatch[1].matchAll(/\{[\s\S]*?"startTime"\s*:\s*"([^"]+)"[\s\S]*?"endTime"\s*:\s*"([^"]+)"[\s\S]*?"title"\s*:\s*"([^"]+)"([\s\S]*?)\}/g);
    for (const bm of blockMatches) {
      const catMatch = bm[4].match(/"category"\s*:\s*"([^"]+)"/);
      const detMatch = bm[4].match(/"details"\s*:\s*"([^"]+)"/);
      const toolsMatch = bm[4].match(/"toolsAndWebsites"\s*:\s*\[([\s\S]*?)\]/);
      const tools = toolsMatch ? [...toolsMatch[1].matchAll(/"([^"]+)"/g)].map((t) => t[1]) : [];
      blocks.push({
        startTime: bm[1],
        endTime: bm[2],
        title: bm[3],
        category: catMatch ? catMatch[1] : 'work',
        details: detMatch ? detMatch[1] : '',
        toolsAndWebsites: tools,
      });
    }
    if (blocks.length > 0) {
      extracted.timeBlocks = blocks;
    }
  }

  if (Object.keys(extracted).length > 0) {
    return extracted;
  }

  return null;
}

async function callOpenAI(prompt: string, model: string): Promise<ReportOutput> {
  const openai = getOpenAI();
  let response: any;

  try {
    response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are an AI assistant that drafts daily EOD reports. You MUST return ONLY a valid JSON object matching the requested schema without markdown wrapping.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 3500,
    });
  } catch (err: any) {
    logger.warn({ model, err: err?.message }, 'Chat completion call error, retrying simple format');
    response = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 3500,
    });
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content || content.trim().length === 0) throw new Error(`Empty response from model ${model}`);

  const parsed = repairAndParseJson(content);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Model ${model} output could not be parsed as JSON: ${content.substring(0, 300)}`);
  }

  // Gracefully normalize output with defaults if partial fields are missing
  const normalized = {
    summary: typeof parsed.summary === 'string' && parsed.summary.trim().length > 0 ? parsed.summary.trim() : 'Completed daily activities and tasks.',
    completedItems: Array.isArray(parsed.completedItems) && parsed.completedItems.length > 0
      ? parsed.completedItems.map(String).filter((s: string) => s.trim().length > 0)
      : typeof parsed.summary === 'string' && parsed.summary.trim().length > 0 ? [parsed.summary.trim()] : ['Progressed on daily tasks and development.'],
    inProgressItems: Array.isArray(parsed.inProgressItems) ? parsed.inProgressItems.map(String).filter((s: string) => s.trim().length > 0) : [],
    blockers: parsed.blockers && typeof parsed.blockers === 'string' && parsed.blockers.toLowerCase() !== 'null' && parsed.blockers.toLowerCase() !== 'none' ? parsed.blockers.trim() : null,
    tomorrowPlan: typeof parsed.tomorrowPlan === 'string' ? parsed.tomorrowPlan.trim() : 'Continue progress on open tasks.',
    timeBlocks: Array.isArray(parsed.timeBlocks)
      ? parsed.timeBlocks
          .map((b: any) => ({
            startTime: String(b?.startTime || '').trim(),
            endTime: String(b?.endTime || '').trim(),
            title: String(b?.title || '').trim(),
            category: String(b?.category || 'work').toLowerCase().trim(),
            details: String(b?.details || '').trim(),
            toolsAndWebsites: Array.isArray(b?.toolsAndWebsites) ? b.toolsAndWebsites.map(String).filter(Boolean) : [],
          }))
          .filter((b: any) => b.startTime && b.endTime && b.title)
          .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
      : undefined,
  };

  const validated = ReportOutputSchema.safeParse(normalized);
  if (!validated.success) {
    throw new Error(`Model ${model} output validation failed: ${JSON.stringify(validated.error.flatten())}`);
  }

  return validated.data;
}


function buildPrompt(
  events: Array<{
    source: string;
    type: string;
    title: string;
    repo: string;
    url: string;
    occurredAt: Date;
    startTime?: Date;
    endTime?: Date;
    rawPayload: any;
  }>,
  settings: {
    reportTemplate: string;
    reportLanguage: string;
    workStartTime: string;
    workEndTime: string;
    includeTimeBlocks?: boolean;
    timezone: string;
  },
  reportDate: string
): string {
  const toneMap: Record<string, string> = {
    professional: 'formal business professional — suitable for a manager',
    minimalist: 'brief and terse — highly focused on the core facts, short sentences',
    modern: 'clear, approachable, and well-structured professional tone',
    executive: 'highly formal, dense, and objective executive summary tone',
    creative: 'friendly, modern, and engaging tone for a startup team',
    qwintsoft: 'straightforward, concise, and structured daily update format',
  };
  const tone = toneMap[settings.reportTemplate] || toneMap.professional;

  const langMap: Record<string, string> = {
    english: 'English',
    hindi: 'Hindi',
    gujarati: 'Gujarati',
  };
  const language = langMap[settings.reportLanguage] || 'English';
  const tz = settings.timezone || 'UTC';

  let eventsText =
    events.length === 0
      ? 'No activity was recorded today.'
      : events
          .map((e) => {
            let timeStr: string;
            if (e.startTime && e.endTime) {
              const s = DateTime.fromJSDate(e.startTime, { zone: tz }).toFormat('HH:mm');
              const end = DateTime.fromJSDate(e.endTime, { zone: tz }).toFormat('HH:mm');
              timeStr = s === end ? s : `${s} – ${end}`;
            } else {
              timeStr = DateTime.fromJSDate(e.occurredAt, { zone: tz }).toFormat('HH:mm');
            }

            let desc = `[${timeStr}] ${e.source.toUpperCase()}: ${e.title}`;
            
            if (e.repo) desc += ` (Repo: ${e.repo})`;
            if (e.source === 'github' && e.url) desc += ` (URL: ${e.url})`;

            if (e.source === 'chatgpt' && e.rawPayload?.messages) {
              const msgs = e.rawPayload.messages.slice(-2); // Only last 2
              const excerpts = msgs.map((m: any) => `${m.role}: ${m.excerpt?.substring(0, 80) || ''}`).join(' | ');
              desc += `\n  -> ${excerpts}`;
            } else if (e.source === 'browser' && e.rawPayload?.durationSeconds) {
              const mins = Math.floor(e.rawPayload.durationSeconds / 60);
              const secs = e.rawPayload.durationSeconds % 60;
              if (mins > 0 || secs > 30) desc += ` (${mins}m ${secs}s active)`;
            }
            return desc;
          })
          .join('\n');

  // We still keep a safety net, but increased to 40,000 chars since it's denser
  if (eventsText.length > 40000) {
    eventsText = eventsText.substring(0, 40000) + '\n\n...[TRUNCATED]...';
  }

  const timeBlockInstructions = settings.includeTimeBlocks
    ? `
10. Time-Block Chronological Activity & Surfing Breakdown:
Because Time-Block Breakdown is ENABLED, synthesize the day's activity into logical chronological time brackets spanning the user's active periods.
CRITICAL TIMING RULES:
- Use the EXACT timestamps and time intervals from the activity events above (all timestamps are in the user's timezone ${tz}).
- NEVER assign multiple distinct websites or tasks to the same generic end-of-day interval (e.g. NEVER make multiple blocks all set to 18:25–18:30).
- If the user visited Coolify at 16:05–16:30, Gmail at 17:15–17:35, Vault X at 17:40–18:05, and RapidAPI at 18:10–18:30, EACH of these must have its own distinct, accurate "startTime" and "endTime" matching when it actually occurred!
- For each time bracket:
  - "startTime": 24-hour format "HH:mm" matching the actual start time in the events (e.g. "14:34", "16:05", "17:15")
  - "endTime": 24-hour format "HH:mm" matching the actual completion/switch time in the events (e.g. "15:30", "16:30", "17:35")
  - "title": Concise 1-line title of the primary work or focus area (e.g. "Coolify Deployment Review & Frontend Validation")
  - "category": One of "development", "research", "browsing", "review", "debugging", "meeting", "planning", "work"
  - "details": 1-2 sentences describing what was accomplished, researched, or surfed during this specific time block
  - "toolsAndWebsites": Array of exact tools, repos, or websites used during this time block (e.g. ["coolify.kachakaran.tech", "github.com/kachakaran6/AutoEOD"])

Return a JSON object with this exact structure:
{
  "summary": "string — 2-3 sentences summarizing my day",
  "completedItems": ["string", ...],
  "inProgressItems": ["string", ...],
  "blockers": "string or null",
  "tomorrowPlan": "string — what I plan to do tomorrow",
  "timeBlocks": [
    {
      "startTime": "09:00",
      "endTime": "10:30",
      "title": "Title of time block",
      "category": "development",
      "details": "Details of work / browsing done",
      "toolsAndWebsites": ["website.com", "tool"]
    }
  ]
}`
    : `
Return a JSON object with exactly this structure:
{
  "summary": "string — 2-3 sentences summarizing my day",
  "completedItems": ["string", ...],
  "inProgressItems": ["string", ...],
  "blockers": "string or null",
  "tomorrowPlan": "string — what I plan to do tomorrow"
}`;

  return `You are an AI assistant that drafts daily EOD (End-of-Day) work reports on behalf of a software engineer.

Today's date: ${reportDate}
User Timezone: ${tz}
Work hours: ${settings.workStartTime} to ${settings.workEndTime}
Tone: ${tone}
Language: Write ALL output fields in ${language}

Below is the complete list of activity recorded for my work today (all timestamps are in ${tz}):

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
${timeBlockInstructions}`;
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

  const tz = settings.timezone || 'UTC';
  // Use full calendar day in user's timezone to ensure all activities performed today are captured
  const dayStart = DateTime.fromISO(reportDate, { zone: tz }).startOf('day');
  const dayEnd = DateTime.fromISO(reportDate, { zone: tz }).endOf('day');

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

  // Fetch timeline sessions if timeblocks or timeline tracking is enabled
  if ((settings as any).includeTimeBlocks) {
    const timelineSessions = await prisma.timelineSession.findMany({
      where: {
        userId,
        startTime: {
          gte: dayStart.toJSDate(),
          lte: dayEnd.toJSDate(),
        },
        selected: true,
      },
      orderBy: { startTime: 'asc' },
    });

    for (const session of timelineSessions) {
      const durMins = Math.max(1, Math.round(session.durationSeconds / 60));
      events.push({
        id: `timeline-${session.id}`,
        source: 'desktop',
        type: 'window_session',
        title: `Used ${session.appName}${session.windowTitle ? ` (${session.windowTitle})` : ''}${session.aiSummary ? ` - ${session.aiSummary}` : ''} [${durMins}m]`,
        repo: session.project || '',
        url: '',
        occurredAt: session.startTime,
        startTime: session.startTime,
        endTime: session.endTime,
        rawPayload: { durationSeconds: session.durationSeconds, appName: session.appName, windowTitle: session.windowTitle, aiSummary: session.aiSummary }
      });
    }
  }

  // Fetch and cluster browser activity logs if includeRadarLogs or includeTimeBlocks is enabled
  if ((settings as any).includeRadarLogs || (settings as any).includeTimeBlocks) {
    const browserLogs = await prisma.browserActivityLog.findMany({
      where: {
        userId,
        tabOpenedAt: {
          gte: dayStart.toJSDate(),
          lte: dayEnd.toJSDate(),
        },
        promotedToEventId: null, // Only unpromoted ones to prevent double-counting
      },
      orderBy: { tabOpenedAt: 'asc' },
    });

    // Cluster consecutive or proximate browsing on the same domain/task into chronological sessions
    const clusters: Array<{
      domain: string;
      startTime: Date;
      endTime: Date;
      durationSeconds: number;
      visitCount: number;
      pageTitles: Set<string>;
      urls: string[];
    }> = [];

    const SESSION_GAP_MS = 15 * 60 * 1000; // 15 minutes max idle gap to merge into same session

    for (const log of browserLogs) {
      const logStart = new Date(log.tabOpenedAt);
      const logEnd = log.tabClosedAt 
        ? new Date(log.tabClosedAt) 
        : new Date(logStart.getTime() + Math.max(log.durationSeconds, 5) * 1000);

      // Find the most recent active cluster for the same domain that ended recently
      const matchingCluster = clusters
        .filter((c) => c.domain === log.domain)
        .reverse()
        .find(
          (c) =>
            Math.abs(logStart.getTime() - c.endTime.getTime()) <= SESSION_GAP_MS ||
            (logStart.getTime() >= c.startTime.getTime() && logStart.getTime() <= c.endTime.getTime() + SESSION_GAP_MS)
        );

      if (matchingCluster) {
        if (logEnd > matchingCluster.endTime) {
          matchingCluster.endTime = logEnd;
        }
        matchingCluster.durationSeconds += log.durationSeconds;
        matchingCluster.visitCount += 1;
        if (log.pageTitle && log.pageTitle.trim() && log.pageTitle !== 'Untitled') {
          matchingCluster.pageTitles.add(log.pageTitle.trim());
        }
        if (log.url && !matchingCluster.urls.includes(log.url)) {
          matchingCluster.urls.push(log.url);
        }
      } else {
        const pageTitles = new Set<string>();
        if (log.pageTitle && log.pageTitle.trim() && log.pageTitle !== 'Untitled') {
          pageTitles.add(log.pageTitle.trim());
        }
        clusters.push({
          domain: log.domain,
          startTime: logStart,
          endTime: logEnd,
          durationSeconds: log.durationSeconds,
          visitCount: 1,
          pageTitles,
          urls: log.url ? [log.url] : [],
        });
      }
    }

    for (const cluster of clusters) {
      // Skip negligible noise (< 20 seconds unless multiple visits)
      if (cluster.durationSeconds < 20 && cluster.visitCount < 2) continue;

      const durationMins = Math.floor(cluster.durationSeconds / 60);
      const durationSecs = cluster.durationSeconds % 60;
      const durationStr = durationMins > 0 ? `${durationMins}m ${durationSecs}s` : `${durationSecs}s`;
      
      const titlesArray = Array.from(cluster.pageTitles);
      const sampleTitle = titlesArray.slice(0, 2).join(' / ') || cluster.domain;
      const visitStr = cluster.visitCount > 1 ? `, ${cluster.visitCount} visits` : '';

      events.push({
        id: `browser-session-${cluster.domain}-${cluster.startTime.getTime()}`,
        source: 'browser',
        type: 'browsing_session',
        title: `Surfed ${cluster.domain} (${durationStr}${visitStr}) - ${sampleTitle}`,
        repo: '',
        url: cluster.urls[0] || `https://${cluster.domain}`,
        occurredAt: cluster.startTime,
        startTime: cluster.startTime,
        endTime: cluster.endTime,
        rawPayload: { durationSeconds: cluster.durationSeconds, count: cluster.visitCount, domain: cluster.domain, titles: titlesArray },
      });
    }
  }

  // Sort events chronologically
  events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  logger.info({ userId, reportDate, eventCount: events.length }, 'Events fetched for report');

  const prompt = buildPrompt(
    events,
    {
      reportTemplate: settings.reportTemplate,
      reportLanguage: settings.reportLanguage,
      workStartTime: settings.workStartTime,
      workEndTime: settings.workEndTime,
      includeTimeBlocks: (settings as any).includeTimeBlocks ?? false,
      timezone: tz,
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
      timeBlocks: (reportOutput.timeBlocks as any) || null,
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
      timeBlocks: (reportOutput.timeBlocks as any) || null,
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
