import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import Redis from 'ioredis';
import { PrismaClient } from './generated/prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

// Initialize Logger
const logger = pino({
  level: env.LOG_LEVEL,
});

// Initialize Prisma Client with PostgreSQL Adapter
const pool = new Pool({ connectionString: env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Redis Client
const redis = new Redis(env.REDIS_URL);

// Initialize Express App
const app = express();

// Setup Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// Basic Health Check Route
app.get('/health', async (req, res) => {
  const healthStatus = {
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

  const statusCode = healthStatus.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Start Server
const port = env.PORT;
const server = app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Graceful shutdown initiated');

  // Force close after timeout
  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT);

  try {
    // 1. Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error(err, 'Error closing HTTP server');
          return reject(err);
        }
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // 2. Disconnect from Database
    await prisma.$disconnect();
    logger.info('Prisma disconnected');

    // 3. Disconnect from Redis
    await redis.quit();
    logger.info('Redis disconnected');

    clearTimeout(timeout);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error(err, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, prisma, redis };
