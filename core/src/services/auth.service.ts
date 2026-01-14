import { type User } from "../generated/prisma/client";
import { UserRoleEnum } from "../generated/prisma/enums";
import type { RegisterDto, VerifyOtpDto } from "../schemas/auth.schema";
import type { AuthResponse, TokenPayload } from "../types/auth.types";
import {
    hashPassword,
    verifyPassword,
    generateOTP,
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
} from "../utils/auth.utils";
import { logger } from "../logger";
import { prisma } from "../db";
import { throwError } from "../utils/errorFunction";

export async function register(data: RegisterDto): Promise<void> {
    const { email, phoneNumber, password, name } = data;
    logger.debug({ context: "REGISTER" }, "Processing registration");

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
        where: {
            email,
        },
    });

    if (existingUser) {
        return throwError(
            400,
            "User with given email already exists",
            "REGISTER"
        );
    }

    const hashedPassword = await hashPassword(password);
    const otp = generateOTP();
    const expiryAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.userOnboarding.deleteMany({
        where: { email },
    });

    await prisma.userOnboarding.create({
        data: {
            name,
            email,
            password: hashedPassword,
            phoneNumber,
            otp,
            expiryAt,
        },
    });

    //TODO: Send OTP via email/SMS
}

export async function verifyOtp(data: VerifyOtpDto): Promise<AuthResponse> {
    const { email, otp } = data;
    logger.debug({ context: "VERIFY-OTP" }, "Verifying OTP");

    const onboardingRecord = await prisma.userOnboarding.findFirst({
        where: { email, otp },
    });

    if (!onboardingRecord) {
        return throwError(
            401,
            "Invalid OTP or email",
            "VERIFY-OTP",
            "Could not find onboarding record with given email and OTP"
        );
    }

    if (new Date() > onboardingRecord.expiryAt) {
        return throwError(
            401,
            "OTP has expired",
            "VERIFY-OTP",
            "OTP has expired for given email"
        );
    }

    // Create User
    const newUser = await prisma.user.create({
        data: {
            name: onboardingRecord.name,
            email: onboardingRecord.email,
            password: onboardingRecord.password,
            phoneNumber: onboardingRecord.phoneNumber,
            role: UserRoleEnum.STUDENT,
        },
    });

    // Clean up onboarding
    await prisma.userOnboarding.delete({
        where: { id: onboardingRecord.id },
    });

    // Generate tokens
    return generateAuthResponse(newUser);
}

export async function resendOtp(email: string): Promise<void> {
    logger.debug(
        { context: "RESEND-OTP", email },
        "Processing resend OTP for email"
    );
    const record = await prisma.userOnboarding.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
    });

    if (!record) {
        throwError(
            404,
            "No pending registration found for this email",
            "RESEND-OTP",
            "Could not find onboarding record for given email"
        );
    }

    const otp = generateOTP();
    const expiryAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.userOnboarding.update({
        where: { id: record.id },
        data: { otp, expiryAt },
    });
}

export async function login(
    email: string,
    password: string
): Promise<AuthResponse> {
    logger.debug({ context: "LOGIN", email }, "Processing login");
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        return throwError(
            401,
            "Invalid email or password",
            "LOGIN",
            "User not found with given email"
        );
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
        return throwError(
            401,
            "Invalid email or password",
            "LOGIN",
            "Password verification failed for given email"
        );
    }

    return generateAuthResponse(user);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
    logger.debug({ context: "REFRESH" }, "Processing token refresh");
    // 1. Verify token signature/encryption
    const payload = await verifyToken<TokenPayload>(refreshToken);

    // 2. Check if token matches DB (Rotation/Security)
    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== refreshToken) {
        // Token reuse or revoked
        if (user) {
            await logout(user.id);
            return throwError(
                401,
                "Invalid refresh token",
                "REFRESH",
                "Refresh token from cookie did not match db refresh token"
            );
        } else {
            return throwError(
                401,
                "Invalid refresh token",
                "REFRESH",
                "User not found given userId in token payload"
            );
        }
    }

    // 3. Generate new tokens
    return generateAuthResponse(user);
}

export async function logout(userId: string): Promise<void> {
    logger.debug({ context: "LOGOUT", userId }, "Processing logout");
    await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
    });
    logger.info({ context: "LOGOUT" }, "User logged out");
}

export async function getSession(userId: string): Promise<Partial<User>> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        return throwError(
            404,
            "User not found",
            "SESSION",
            `No user found with givenuserId`
        );
    }
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };
}

async function generateAuthResponse(user: User): Promise<AuthResponse> {
    const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        expiresAt: "", // will be set in token generation
        issuer: "", // will be set in token generation
    };

    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);

    // Save refresh token to DB
    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
    });

    logger.debug({ context: "AUTH" }, "Tokens generated successfully");

    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
        },
        tokens: {
            accessToken,
            refreshToken,
        },
    };
}
