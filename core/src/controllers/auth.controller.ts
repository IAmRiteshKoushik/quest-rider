import type { Request, Response } from 'express';
import * as AuthService from '../services/auth.service';
import type { RegisterDto, VerifyOtpDto, LoginDto, ResendOtpDto } from '../schemas/auth.schema';
import { registerSchema, verifyOtpSchema, resendOtpSchema, loginSchema } from '../schemas/auth.schema';
import { env } from '../env';
import { logger } from '../logger';
import { handleValidation } from '../utils/handleValidation';
import { throwError } from '../utils/errorFunction';

function setCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60 * 1000,
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: env.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearCookies(res: Response) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
}

export const register = async (req: Request, res: Response) => {
  const data: RegisterDto = handleValidation(registerSchema, req.body, 'REGISTER');
  await AuthService.register(data);
  
  logger.info({ context: 'REGISTER' }, 'Registration successful, OTP sent');
  res.status(200).json({ message: 'OTP sent successfully' });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const data: VerifyOtpDto = handleValidation(verifyOtpSchema, req.body, 'VERIFY-OTP');
  const { user, tokens } = await AuthService.verifyOtp(data);
  
  setCookies(res, tokens.accessToken, tokens.refreshToken);
  logger.info({ context: 'VERIFY-OTP' }, 'OTP verified successfully');
  res.status(200).json(user);
};

export const resendOtp = async (req: Request, res: Response) => {
  const { email }: ResendOtpDto = handleValidation(resendOtpSchema, req.body, 'RESEND-OTP');
  await AuthService.resendOtp(email);
  
  logger.info({ context: 'RESEND-OTP' }, 'OTP resent successfully');
  res.status(200).json({ message: 'OTP resent successfully' });
};

export const login = async (req: Request, res: Response) => {
  const { email, password }: LoginDto = handleValidation(loginSchema, req.body, 'LOGIN');
  const { user, tokens } = await AuthService.login(email, password);

  setCookies(res, tokens.accessToken, tokens.refreshToken);
  logger.info({ context: 'LOGIN' }, 'Login successful');
  res.status(200).json(user);
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return throwError(401, 'Missing refresh token', 'REFRESH');
  }

  try {
    const { tokens } = await AuthService.refresh(refreshToken);
    setCookies(res, tokens.accessToken, tokens.refreshToken);
    logger.info({ context: 'REFRESH' }, 'Token refreshed successfully');
    res.status(200).json({ message: 'Token refreshed' });
  } catch (error) {
    clearCookies(res);
    logger.warn({ context: 'REFRESH' }, 'Invalid refresh token');
    res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  clearCookies(res);
  logger.info({ context: 'LOGOUT' }, 'Logged out successfully');
  res.status(200).json({ message: 'Logged out successfully' });
};

export const session = async (req: Request, res: Response) => {
  const userId = req.userId;
  
  if (!userId) {
    return throwError(401, 'Unauthorized', 'SESSION', 'No user ID found in request');
  }
  const user = await AuthService.getSession(userId);
  
  logger.info({ context: 'SESSION' }, 'Session retrieved successfully');
  res.status(200).json({
     id: user.id,
     email: user.email,
     name: user.name,
     role: user.role,
  });
};