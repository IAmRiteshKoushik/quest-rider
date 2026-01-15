import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env";

export const logger = pino({
    level: env.LOG_LEVEL,
    transport:
        env.NODE_ENV === "development"
            ? {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "SYS:yyyy-mm-dd hh:MM:ss TT",
                      ignore: "pid,hostname",
                      colorizeObjects: true,
                  },
              }
            : undefined,
});

export const httpLogger = pinoHttp({
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
});