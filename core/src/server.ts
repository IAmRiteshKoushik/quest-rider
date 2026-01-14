import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import { env } from './env';
import { logger } from './logger';
import { getHealthStatus } from './services/health.service';
import { authRouter } from './routes/auth.routes';
import { prisma } from './db';
import { redis } from './redis';
import { errorHandler } from './middlewares/error.middleware';

// Initialize Express App
const app = express();

// Setup Middleware
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(errorHandler);
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));

// Basic Health Check Route
app.get('/health', async (req, res) => {
  const healthStatus = await getHealthStatus();
  const statusCode = healthStatus.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// Mount Routes
app.use('/auth', authRouter);

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

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

export { app };
