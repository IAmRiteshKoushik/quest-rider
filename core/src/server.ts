import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { logger, httpLogger } from "./logger";
import { getHealthStatus } from "./services/health.service";
import { authRouter } from "./routes/auth.routes";
import { courseRouter } from "./routes/course.routes";
import { meRouter } from "./routes/me.routes";
import { prisma } from "./db";
import { redis } from "./redis";
import { errorHandler } from "./middlewares/error.middleware";
import requestID from "express-request-id";

// Initialize Express App
const app = express();

// Setup Middleware
app.use(requestID());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(httpLogger);
app.use(helmet());
app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
    })
);

// Basic Health Check Route
app.get("/health", async (req, res) => {
    const healthStatus = await getHealthStatus();
    const statusCode = healthStatus.status === "ok" ? 200 : 503;
    res.status(statusCode).json(healthStatus);
});

// Mount Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/me", meRouter);

// Error Handler
app.use(errorHandler);

// Start Server
const port = env.PORT;
const server = app.listen(port, () => {
    logger.info({ context: "SERVER", port }, "Server listening");
});

// Graceful Shutdown
const shutdown = async (signal: string) => {
    logger.info({ context: "SERVER", signal }, "Graceful shutdown initiated");

    // Force close after timeout
    const timeout = setTimeout(() => {
        logger.error({ context: "SERVER" }, "Shutdown timed out, forcing exit");
        process.exit(1);
    }, env.SHUTDOWN_TIMEOUT);

    try {
        // 1. Stop accepting new connections
        await new Promise<void>((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    logger.error(
                        { context: "SERVER", err },
                        "Error closing HTTP server"
                    );
                    return reject(err);
                }
                logger.info({ context: "SERVER" }, "HTTP server closed");
                resolve();
            });
        });

        // 2. Disconnect from Database
        await prisma.$disconnect();
        logger.info("Prisma disconnected");

        // 3. Disconnect from Redis
        await redis.quit();
        logger.info("Redis disconnected");
        clearTimeout(timeout);
        logger.info("Shutdown complete");
        process.exit(0);
    } catch {
        logger.error("Error during shutdown");
        process.exit(1);
    }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

export { app };
