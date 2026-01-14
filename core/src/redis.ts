import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL);

redis.on('error', (err) => {
    logger.error({ context: 'REDIS', err }, 'Redis connection error');
});

redis.on('connect', () => {
    logger.info({ context: 'REDIS' }, 'Connected to Redis successfully');
});
