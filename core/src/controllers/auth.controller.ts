import type { Request, Response } from "express";
import * as AuthService from "../services/auth.service";
import type {
    RegisterDto,
    VerifyOtpDto,
    LoginDto,
    ResendOtpDto,
} from "../schemas/auth.schema";
import {
    registerSchema,
    verifyOtpSchema,
    resendOtpSchema,
    loginSchema,
} from "../schemas/auth.schema";
import { env } from "../env";
import { handleValidation } from "../utils/handleValidation";
import { UnauthorizedError } from "../utils/errors";

function setCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: env.ACCESS_TOKEN_EXPIRE_MINUTES * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: env.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
    });
}

function clearCookies(res: Response) {
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });
}

export const register = async (req: Request, res: Response) => {
    const data: RegisterDto = handleValidation(registerSchema, req.body);
    await AuthService.register(data);

    res.status(200).json({ message: "OTP sent successfully" });
};

export const verifyOtp = async (req: Request, res: Response) => {
    const data: VerifyOtpDto = handleValidation(verifyOtpSchema, req.body);
    const { user, tokens } = await AuthService.verifyOtp(data);

    setCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(200).json(user);
};

export const resendOtp = async (req: Request, res: Response) => {
    const { email }: ResendOtpDto = handleValidation(resendOtpSchema, req.body);
    await AuthService.resendOtp(email);

    res.status(200).json({ message: "OTP resent successfully" });
};

export const login = async (req: Request, res: Response) => {
    const { email, password }: LoginDto = handleValidation(
        loginSchema,
        req.body
    );
    const { user, tokens } = await AuthService.login(email, password);

    setCookies(res, tokens.accessToken, tokens.refreshToken);
    res.status(200).json(user);
};

export const refresh = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
        throw new UnauthorizedError("Missing refresh token");
    }

    try {
        const { tokens } = await AuthService.refresh(refreshToken);
        setCookies(res, tokens.accessToken, tokens.refreshToken);
        res.status(200).json({ message: "Token refreshed" });
    } catch (error) {
        clearCookies(res);
        throw error;
    }
};

export const logout = async (req: Request, res: Response) => {
    const userId = req.userId;
    if (userId) {
        await AuthService.logout(userId);
    }
    clearCookies(res);
    res.status(200).json({ message: "Logged out successfully" });
};

export const session = async (req: Request, res: Response) => {
    const userId = req.userId;

    if (!userId) {
        throw new UnauthorizedError(
            "Unauthorized",
            "No user ID found in request"
        );
    }
    const user = await AuthService.getSession(userId);

    res.status(200).json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    });
};
