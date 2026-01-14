import Redis from 'ioredis';
import { logger } from '../logger';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    db: 'up' | 'down' | 'unknown';
    redis: 'up' | 'down' | 'unknown';
  };
}

export class HealthService {
  constructor(private prisma: any, private redis: Redis) {}

  async getHealthStatus(): Promise<HealthStatus> {
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
      await this.prisma.$queryRaw`SELECT 1`;
      healthStatus.services.db = 'up';
    } catch (error) {
      logger.error(error, 'Database health check failed');
      healthStatus.services.db = 'down';
      healthStatus.status = 'error';
    }

    try {
      // Check Redis connection
      await this.redis.ping();
      healthStatus.services.redis = 'up';
    } catch (error) {
      logger.error(error, 'Redis health check failed');
      healthStatus.services.redis = 'down';
      healthStatus.status = 'error';
    }

    return healthStatus;
  }
}
