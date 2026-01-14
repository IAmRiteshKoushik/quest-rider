import { encrypt, decrypt } from 'paseto-ts/v4';
import * as argon2 from 'argon2';
import { env } from '../env';
import type { TokenPayload } from '../types/auth.types';
import { randomInt } from 'node:crypto';

// Your PASERK v4.local key
const KEY = env.APP_SECRET; // e.g., 'k4.local.…'

// issuer
const ISSUER = env.TOKEN_ISSUER;

export const hashPassword = async (plain: string): Promise<string> => {
  return await argon2.hash(plain);
};

export const verifyPassword = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

export const generateAccessToken = async (payload: TokenPayload): Promise<string> => {
  const expiresAt = new Date(
    Date.now() + env.ACCESS_TOKEN_EXPIRE_MINUTES * 60 * 1000
  ).toISOString();

  return encrypt(
    KEY,
    {
      ...payload,
      expiresAt: expiresAt,
      issuer: ISSUER,
    }
  );
};

export const generateRefreshToken = async (payload: TokenPayload): Promise<string> => {
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  return encrypt(
    KEY,
    {
      ...payload,
      expiresAt: expiresAt,
      issuer: ISSUER,
    }
  );
};

export const verifyToken = async <T extends { [key: string]: any; } = TokenPayload>(token: string): Promise<T> => {
  const result = decrypt<T>(KEY, token);
  return result.payload; // decrypt returns { payload, footer }
};

export function generateOTP(length = 6): string {
  const max = 10 ** length;       // e.g., 1000000 for length 6
  const min = Math.floor(max / 10); // e.g., 100000 for length 6

  // crypto.randomInt generates a secure random integer in [min, max)
  const otp = randomInt(min, max).toString().padStart(length, '0');

  return otp;
}
