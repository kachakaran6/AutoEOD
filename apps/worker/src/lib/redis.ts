// apps/worker/src/lib/redis.ts
import { Redis } from 'ioredis';
import { logger } from './logger';

export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisConnection.on('error', (err) => logger.error({ err }, 'Worker Redis error'));
redisConnection.on('connect', () => logger.info('Worker Redis connected'));
