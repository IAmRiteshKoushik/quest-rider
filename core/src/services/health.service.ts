import { logger } from '../logger';
import { prisma } from '../db';
import { redis } from '../redis';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    db: 'up' | 'down' | 'unknown';
    redis: 'up' | 'down' | 'unknown';
  };
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const healthStatus: HealthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      db: 'unknown',
      redis: 'unknown',
    },
  };

  try {
    // Check Database connection
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.services.db = 'up';
  } catch (error) {
    logger.error(error, 'Database health check failed');
    healthStatus.services.db = 'down';
    healthStatus.status = 'error';
  }

  try {
    // Check Redis connection
    await redis.ping();
    healthStatus.services.redis = 'up';
  } catch (error) {
    logger.error(error, 'Redis health check failed');
    healthStatus.services.redis = 'down';
    healthStatus.status = 'error';
  }

  return healthStatus;
}