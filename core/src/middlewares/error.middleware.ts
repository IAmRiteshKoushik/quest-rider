import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';
import { AppError } from '../utils/errorFunction';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = "Oops! Something went wrong. Please try again later.";
  let context = 'unknown';
  let details = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    context = err.context || context;
    details = err.details;
  }

  const logData = {
    context,
    message: err.message,
    details,
    err: statusCode >= 500 ? err : undefined,
    path: req.path,
    method: req.method,
    reqBody: statusCode < 500 ? req.body : undefined,
    statusCode
  };

  if (statusCode >= 500) {
    logger.error(logData, 'Request failed');
  } else {
    logger.warn(logData, 'Request warning');
  }

  res.status(statusCode).json({ 
    error: message
  });
};