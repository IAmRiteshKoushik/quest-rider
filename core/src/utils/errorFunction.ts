export class AppError extends Error {
  public statusCode: number;
  public context?: string;
  public details?: any;

  constructor(statusCode: number, message: string, context: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.context = context;
    this.details = details;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function throwError(statusCode: number, message: string, context: string, details?: any): never {
  throw new AppError(statusCode, message, context, details);
}