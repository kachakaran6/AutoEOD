// apps/api/src/lib/redis.ts
// Shared Redis connection for BullMQ

import { Redis } from 'ioredis';
import { logger } from './logger';

export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required for BullMQ
  lazyConnect: true,
});

redisConnection.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redisConnection.on('connect', () => {
  logger.info('Redis connected');
});
