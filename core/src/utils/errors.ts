export enum ErrorCode {
    BAD_REQUEST = "BAD_REQUEST",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    NOT_FOUND = "NOT_FOUND",
    CONFLICT = "CONFLICT",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
}

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: ErrorCode;
    public readonly details?: any;
    public readonly isOperational: boolean;

    constructor(
        statusCode: number,
        errorCode: ErrorCode,
        message: string,
        details?: any,
        isOperational = true
    ) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.details = details;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends AppError {
    constructor(message = "Bad Request", details?: any) {
        super(400, ErrorCode.BAD_REQUEST, message, details);
    }
}

export class ValidationError extends AppError {
    constructor(details?: any, message = "Validation Failed") {
        super(400, ErrorCode.VALIDATION_ERROR, message, details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", details?: any) {
        super(401, ErrorCode.UNAUTHORIZED, message, details);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden", details?: any) {
        super(403, ErrorCode.FORBIDDEN, message, details);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource Not Found", details?: any) {
        super(404, ErrorCode.NOT_FOUND, message, details);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict", details?: any) {
        super(409, ErrorCode.CONFLICT, message, details);
    }
}

export class InternalServerError extends AppError {
    constructor(message = "Internal Server Error", details?: any) {
        super(500, ErrorCode.INTERNAL_SERVER_ERROR, message, details, false);
    }
}
