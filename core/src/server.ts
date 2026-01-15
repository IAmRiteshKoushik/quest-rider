import express from "express";
import helmet from "helmet";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { env } from "./env";
import { logger } from "./logger";
import { getHealthStatus } from "./services/health.service";
import { authRouter } from "./routes/auth.routes";
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
app.use(
    pinoHttp({
        logger,
        genReqId: (req) => (req as any).id,
        customLogLevel: (req, res, err) => {
            if (res.statusCode >= 500 || err) return "error";
            if (res.statusCode >= 400) return "warn";
            return "info";
        },
        customProps: (req, res) => {
            return (res as any).errInfo || {};
        },
        customSuccessMessage: (req, res) => {
            return `${res.statusCode} ${req.method} ${req.url}`;
        },
        customErrorMessage: (req, res, err) => {
            return `${req.method} ${req.url} failed with ${res.statusCode}: ${err.message}`;
        },
        serializers: {
            req: (req) => {
                const isDev = env.NODE_ENV === "development";
                const body = req.raw.body;
                const cookieHeader = req.headers["cookie"];

                return {
                    method: req.method,
                    url: req.url,
                    query: req.query,
                    userAgent: req.headers["user-agent"],
                    ...(isDev && body && { body }),
                    ...(isDev &&
                        cookieHeader && {
                            cookies: cookieHeader
                                .split("; ")
                                .reduce(
                                    (
                                        acc: Record<string, string>,
                                        cookie: string
                                    ) => {
                                        const [name, ...rest] =
                                            cookie.split("=");
                                        if (name) acc[name] = rest.join("=");
                                        return acc;
                                    },
                                    {}
                                ),
                        }),
                };
            },
            res: (res) => ({
                statusCode: res.statusCode,
            }),
        },
        quietReqLogger: true,
    })
);
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
        logger.info({ context: "SERVER" }, "Prisma disconnected");

        // 3. Disconnect from Redis
        await redis.quit();
        logger.info({ context: "SERVER" }, "Redis disconnected");

        clearTimeout(timeout);
        logger.info({ context: "SERVER" }, "Shutdown complete");
        process.exit(0);
    } catch (err) {
        logger.error({ context: "SERVER", err }, "Error during shutdown");
        process.exit(1);
    }
};

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

export { app };
