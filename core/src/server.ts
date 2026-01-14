import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import Redis from 'ioredis';
import { PrismaClient } from './generated/prisma/client';
import { z } from 'zod';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';


const envSchema = z.object({
  PORT: z.string().default('8080'),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
});

// process.env is automatically loaded by Bun from .env
const env = envSchema.parse(process.env);

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
const port = parseInt(env.PORT, 10);
const server = app.listen(port, () => {
  logger.info(`Server listening on port ${port}`);
});

// Graceful Shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  
  server.close((err) => {
    if (err) {
      logger.error(err, 'Error closing HTTP server');
    } else {
      logger.info('HTTP server closed');
    }
  });

  try {
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  } catch (err) {
    logger.error(err, 'Error disconnecting Prisma');
  }

  try {
    await redis.quit();
    logger.info('Redis disconnected');
  } catch (err) {
    logger.error(err, 'Error disconnecting Redis');
  }

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, prisma, redis };
