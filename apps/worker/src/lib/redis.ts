// apps/worker/src/lib/redis.ts
import { Redis } from 'ioredis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  tls: redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

redisConnection.on('error', (err) => logger.error({ err }, 'Worker Redis error'));
redisConnection.on('connect', () => logger.info('Worker Redis connected'));
