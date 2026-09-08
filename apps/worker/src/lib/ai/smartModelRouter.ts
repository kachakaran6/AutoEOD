// apps/worker/src/lib/ai/smartModelRouter.ts
// Intelligent model routing & fallback engine for OpenRouter and OpenAI API

import { logger } from '../logger';

// Battle-tested, currently available free models on OpenRouter
export const STATIC_FREE_MODELS: string[] = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'deepseek/deepseek-chat:free',
  'deepseek/deepseek-r1:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-2.0-flash-lite-preview-02-05:free',
  'mistralai/mistral-small-24b-instruct-2501:free',
  'mistralai/mistral-7b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'google/gemma-2-9b-it:free',
];

interface OpenRouterModelItem {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

class SmartModelRouter {
  private dynamicFreeModels: string[] = [];
  private lastCatalogFetchTime = 0;
  private catalogTtlMs = 60 * 60 * 1000; // 1 hour TTL
  private modelCooldowns = new Map<string, number>(); // model -> timestamp when cool-off expires

  /**
   * Dynamically fetch active free models from OpenRouter catalog.
   * Gracefully falls back to static list if offline or error.
   */
  public async getDynamicFreeModels(): Promise<string[]> {
    const now = Date.now();
    if (this.dynamicFreeModels.length > 0 && now - this.lastCatalogFetchTime < this.catalogTtlMs) {
      return this.dynamicFreeModels;
    }

    const baseURL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
    if (!baseURL.includes('openrouter.ai')) {
      return STATIC_FREE_MODELS;
    }

    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const json = (await res.json()) as { data?: OpenRouterModelItem[] };
        const items = json.data || [];

        // Filter models that are marked free
        const freeItems = items.filter((m) => {
          const isFreeSlug = m.id.endsWith(':free');
          const isFreePrice =
            m.pricing?.prompt === '0' && m.pricing?.completion === '0';
          return isFreeSlug || isFreePrice;
        });

        // Score models by capability
        const scored = freeItems.map((m) => {
          let score = 0;
          const idLower = m.id.toLowerCase();
          if (idLower.includes('70b') || idLower.includes('72b')) score += 50;
          if (idLower.includes('llama-3.3')) score += 40;
          if (idLower.includes('deepseek')) score += 35;
          if (idLower.includes('gemini-2.0')) score += 30;
          if (idLower.includes('mistral-small')) score += 25;
          if (idLower.includes('coder') || idLower.includes('instruct')) score += 20;
          if (m.context_length && m.context_length >= 32768) score += 10;
          return { id: m.id, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const discovered = scored.map((s) => s.id);

        if (discovered.length > 0) {
          // Merge discovered with known static models so we never lose baseline fallbacks
          this.dynamicFreeModels = [...new Set([...discovered, ...STATIC_FREE_MODELS])];
          this.lastCatalogFetchTime = now;
          logger.info(
            { count: this.dynamicFreeModels.length },
            'Successfully refreshed dynamic OpenRouter free model catalog'
          );
          return this.dynamicFreeModels;
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Failed to fetch OpenRouter model catalog, using static fallback list');
    }

    this.dynamicFreeModels = STATIC_FREE_MODELS;
    this.lastCatalogFetchTime = now;
    return this.dynamicFreeModels;
  }

  /**
   * Determine whether a model is currently in a cooldown window
   */
  public isModelAvailable(model: string): boolean {
    const expiresAt = this.modelCooldowns.get(model);
    if (!expiresAt) return true;
    if (Date.now() > expiresAt) {
      this.modelCooldowns.delete(model);
      return true;
    }
    return false;
  }

  /**
   * Penalize a model that encountered an error (cooldown based on failure type).
   * Checks for replacement slug suggestion in error message.
   */
  public markModelFailure(model: string, err: any): string | null {
    const errorMsg = String(err?.message || err || '');
    const status = err?.status || err?.statusCode || (err?.response ? err.response.status : undefined);

    let cooldownMs = 5 * 60 * 1000; // 5 min default

    // Detect slug redirection in error text (e.g. "use this slug instead: google/gemma-3-27b-it")
    let suggestedSlug: string | null = null;
    const slugMatch = errorMsg.match(/use this slug instead:\s*([a-zA-Z0-9_\-./:]+)/i);
    if (slugMatch && slugMatch[1]) {
      suggestedSlug = slugMatch[1].trim();
      logger.info({ model, suggestedSlug }, 'Detected OpenRouter model slug replacement recommendation');
    }

    if (status === 404 || errorMsg.includes('unavailable for free') || errorMsg.includes('not found')) {
      cooldownMs = 24 * 60 * 60 * 1000; // 24 hours for deprecated/missing models
    } else if (status === 429 || errorMsg.includes('rate limit')) {
      cooldownMs = 3 * 60 * 1000; // 3 minutes for rate limits
    } else if (status === 402 || errorMsg.includes('payment') || errorMsg.includes('credit')) {
      cooldownMs = 12 * 60 * 60 * 1000; // 12 hours for paid-only models
    }

    this.modelCooldowns.set(model, Date.now() + cooldownMs);
    logger.warn({ model, status, cooldownMs: Math.round(cooldownMs / 1000) }, 'Model placed in temporary cooldown');

    return suggestedSlug;
  }

  /**
   * Build a prioritized, non-cooldown model cascade
   */
  public async getModelCascade(extraPreferred?: string): Promise<string[]> {
    const dynamicFree = await this.getDynamicFreeModels();

    const envPrimary = process.env.OPENAI_MODEL;
    const envFallback = process.env.OPENAI_FALLBACK_MODEL;

    // Ordered sequence of preferences
    const rawCascade: string[] = [];
    if (extraPreferred) rawCascade.push(extraPreferred);
    if (envPrimary) rawCascade.push(envPrimary);
    if (envFallback) rawCascade.push(envFallback);

    for (const m of dynamicFree) {
      rawCascade.push(m);
    }
    for (const m of STATIC_FREE_MODELS) {
      rawCascade.push(m);
    }

    // Deduplicate and filter out cooling-down models
    const unique = [...new Set(rawCascade.filter(Boolean))];
    const available = unique.filter((m) => this.isModelAvailable(m));

    // If every model is somehow in cooldown, reset cooldowns to avoid total gridlock
    if (available.length === 0) {
      logger.warn('All models were in cooldown! Clearing cooldown cache to prevent outage');
      this.modelCooldowns.clear();
      return unique.slice(0, 15);
    }

    return available.slice(0, 15);
  }
}

export const smartModelRouter = new SmartModelRouter();
