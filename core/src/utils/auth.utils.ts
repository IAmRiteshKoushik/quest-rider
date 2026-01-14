import { encrypt, decrypt } from 'paseto-ts/v4';
import * as argon2 from 'argon2';
import { env } from '../env';

// Your PASERK v4.local key
const KEY = env.APP_SECRET; // e.g., 'k4.local.…'

// issuer
const ISSUER = 'QuestRider';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  expiresAt: string;
  issuer: string;
  [key: string]: any;
}

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

export const generateOTP = (length = 6): string => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};
