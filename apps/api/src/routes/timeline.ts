import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@autoeod/db';
import { requireAuth } from '../middleware/auth';
import { recordAuditLog } from '../lib/audit';
import { logger } from '../lib/logger';
import OpenAI from 'openai';

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

export const timelineRouter = Router();

// Used by desktop agent and browser extension
timelineRouter.post('/events', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;

  const schema = z.object({
    events: z.array(z.object({
      timestamp: z.string(),
      appName: z.string().optional(),
      windowTitle: z.string().optional(),
      domain: z.string().optional(),
      url: z.string().optional(),
      durationSeconds: z.number().default(5)
    }))
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Validation failed' });
    return;
  }

  // Smart Session Merging
  // Get the most recent session for this user for today
  const events = parse.data.events;
  if (events.length === 0) {
    res.json({ success: true });
    return;
  }

  // Sort events by time
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  for (const ev of events) {
    const evTime = new Date(ev.timestamp);
    
    // Find the latest session
    const lastSession = await prisma.timelineSession.findFirst({
      where: { userId },
      orderBy: { endTime: 'desc' }
    });

    const appName = ev.appName || 'Browser';
    const project = ev.domain || '';
    const title = ev.windowTitle || ev.url || 'Unknown Activity';

    let shouldMerge = false;

    if (lastSession) {
      const timeDiff = evTime.getTime() - lastSession.endTime.getTime();
      // If same app and project, and time difference is small (e.g. less than 2 minutes gap)
      if (
        lastSession.appName === appName &&
        lastSession.project === project &&
        timeDiff < 120000 // 2 minutes
      ) {
        shouldMerge = true;
      }
    }

    if (shouldMerge && lastSession) {
      await prisma.timelineSession.update({
        where: { id: lastSession.id },
        data: {
          endTime: new Date(evTime.getTime() + ev.durationSeconds * 1000),
          durationSeconds: { increment: ev.durationSeconds },
          windowTitle: title // Keep latest title as it might be more specific
        }
      });
    } else {
      await prisma.timelineSession.create({
        data: {
          userId,
          startTime: evTime,
          endTime: new Date(evTime.getTime() + ev.durationSeconds * 1000),
          durationSeconds: ev.durationSeconds,
          appName,
          windowTitle: title,
          project,
          detectedTask: 'Working on ' + (project || appName)
        }
      });
    }
  }

  res.json({ success: true, processed: events.length });
});

// GET /api/timeline
timelineRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.userId!;
  const dateStr = req.query.date as string; // YYYY-MM-DD
  
  let startOfDay, endOfDay;
  if (dateStr) {
    startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    endOfDay = new Date(dateStr + 'T23:59:59.999Z');
  } else {
    startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);
  }

  const sessions = await prisma.timelineSession.findMany({
    where: {
      userId,
      startTime: { gte: startOfDay, lte: endOfDay }
    },
    orderBy: { startTime: 'asc' }
  });

  res.json(sessions);
});

// PATCH /api/timeline/:id
timelineRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;
  
  const schema = z.object({
    aiSummary: z.string().optional(),
    selected: z.boolean().optional(),
    windowTitle: z.string().optional()
  });

  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  try {
    const updated = await prisma.timelineSession.update({
      where: { id, userId },
      data: parse.data
    });
    res.json(updated);
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
});

// DELETE /api/timeline/:id
timelineRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;

  try {
    await prisma.timelineSession.delete({
      where: { id, userId }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: 'Not found' });
  }
});

// POST /api/timeline/generate-summaries
timelineRouter.post('/generate-summaries', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  // For each session without an aiSummary, use OpenAI to generate one
  const sessions = await prisma.timelineSession.findMany({
    where: { userId, aiSummary: null }
  });

  if (sessions.length === 0) {
    res.json({ success: true, count: 0 });
    return;
  }

  try {
    const openai = getOpenAI();
    
    // Batch process sessions to avoid huge context, but for simplicity, we send them in one big array
    // and ask for a JSON map back.
    const prompt = `You are an AI that summarizes raw window tracking data into clean, professional activity summaries.
Below is a JSON array of tracked sessions with 'id', 'appName', 'windowTitle', and 'durationSeconds'.
For each session, provide a 1-sentence summary of what the user was doing. Keep it professional.

Input Sessions:
${JSON.stringify(sessions.map((s: any) => ({ id: s.id, appName: s.appName, windowTitle: s.windowTitle, duration: s.durationSeconds })))}

Return ONLY a JSON object mapping the 'id' to the generated 'summary' string.
Example: { "session_id_1": "Reviewed PR for feature X", "session_id_2": "Browsed documentation for React" }
`;

    const candidateModels = [
      process.env.OPENAI_MODEL,
      process.env.OPENAI_FALLBACK_MODEL,
      'minimax/minimax-m3:free',
      'cohere/north-mini-code:free',
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openrouter/free',
    ].filter(Boolean) as string[];
    const modelCascade = [...new Set(candidateModels)];

    let summariesMap: Record<string, string> | null = null;
    let usedModel = modelCascade[0];
    let lastError: any = null;

    for (const model of modelCascade) {
      try {
        const response = await openai.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content || content.trim().length === 0) throw new Error(`Empty response from model ${model}`);

        let rawJson = content.trim();
        rawJson = rawJson.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
        rawJson = rawJson.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        const firstBrace = rawJson.indexOf('{');
        const lastBrace = rawJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const candidate = rawJson.substring(firstBrace, lastBrace + 1);
          try {
            summariesMap = JSON.parse(candidate) as Record<string, string>;
          } catch {
            try {
              const sanitized = candidate.replace(/,\s*([\]}])/g, '$1');
              summariesMap = JSON.parse(sanitized) as Record<string, string>;
            } catch {}
          }
        }

        if (!summariesMap) {
          summariesMap = JSON.parse(rawJson) as Record<string, string>;
        }

        usedModel = model;
        break;
      } catch (err: any) {
        lastError = err;
        logger.warn({ model, err: err?.message }, 'Timeline summary attempt failed, trying fallback');
      }
    }

    if (!summariesMap) {
      throw new Error(`Failed to generate summaries with all cascade models: ${lastError instanceof Error ? lastError.message : 'Unknown'}`);
    }

    for (const [id, summary] of Object.entries(summariesMap)) {
      await prisma.timelineSession.update({
        where: { id },
        data: { aiSummary: typeof summary === 'string' ? summary : String(summary) }
      });
    }

    await recordAuditLog({
      action: 'AI_TIMELINE_SUMMARIZED',
      userId,
      level: 'info',
      details: {
        model: usedModel,
        sessionCount: Object.keys(summariesMap).length,
      }
    });

    res.json({ success: true, count: Object.keys(summariesMap).length, model: usedModel });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate summaries' });
  }
});
