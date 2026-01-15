import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import { AppError, ErrorCode } from "../utils/errors";
import { env } from "../env";

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    let statusCode = 500;
    let errorCode = ErrorCode.INTERNAL_SERVER_ERROR;
    let message = "Oops! Something went wrong. Please try again later.";
    let details = undefined;

    if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorCode = err.errorCode;
        message = err.message;
        details = err.details;
    }

    const isProduction = env.NODE_ENV === "production";

    // Attach info for the request logger (pino-http)
    (res as any).errInfo = {
        errorCode,
        details,
        message: err.message,
        // stack: isProduction ? undefined : err.stack,
    };

    res.status(statusCode).json({
        error: errorCode,
        message:
            statusCode >= 500 && isProduction
                ? "Oops! Something went wrong. Please try again later."
                : message,
        details,
    });
};
