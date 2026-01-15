import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.utils";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";
import type { TokenPayload } from "../types/auth.types";
import { env } from "../env";

// Extend Express Request interface to include user
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            email?: string;
            role?: string;
            expiresAt?: string;
            issuer?: string;
        }
    }
}

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const token = req.cookies.accessToken;

    if (!token) {
        throw new UnauthorizedError("No access token found");
    }

    let payload: TokenPayload;
    try {
        payload = await verifyToken<TokenPayload>(token);
    } catch (err) {
        throw new UnauthorizedError("Invalid or tampered token", err);
    }

    if (new Date(payload.expiresAt) < new Date()) {
        throw new UnauthorizedError("Expired access token");
    }

    if (payload.issuer !== env.TOKEN_ISSUER) {
        throw new UnauthorizedError("Invalid token issuer");
    }

    // Attach user info to request
    req.userId = payload.userId;
    req.email = payload.email;
    req.role = payload.role;

    next();
};

export const requireRole = (role: string) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.role || req.role !== role) {
            throw new ForbiddenError(
                `Required role was ${role}, but user role is ${req.role}`
            );
        }
        next();
    };
};
