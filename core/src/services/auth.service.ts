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
import {
    ConflictError,
    NotFoundError,
    UnauthorizedError,
} from "../utils/errors";

export async function register(data: RegisterDto): Promise<void> {
    const { email, phoneNumber, password, name } = data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
        where: { email },
    });

    if (existingUser) {
        throw new ConflictError("User with given email already exists");
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

    logger.debug({ email }, "User onboarding record created");
    //TODO: Send OTP via email/SMS
}

export async function verifyOtp(data: VerifyOtpDto): Promise<AuthResponse> {
    const { email, otp } = data;

    const onboardingRecord = await prisma.userOnboarding.findFirst({
        where: { email, otp },
    });

    if (!onboardingRecord) {
        throw new UnauthorizedError("Invalid OTP or email");
    }

    if (new Date() > onboardingRecord.expiryAt) {
        throw new UnauthorizedError("OTP has expired");
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

    return generateAuthResponse(newUser);
}

export async function resendOtp(email: string): Promise<void> {
    const record = await prisma.userOnboarding.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
    });

    if (!record) {
        throw new NotFoundError("No pending registration found for this email");
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
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        throw new UnauthorizedError("Invalid email or password");
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
        throw new UnauthorizedError("Invalid email or password");
    }

    return generateAuthResponse(user);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await verifyToken<TokenPayload>(refreshToken);

    const user = await prisma.user.findUnique({
        where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== refreshToken) {
        if (user) {
            await logout(user.id);
        }
        throw new UnauthorizedError("Invalid refresh token");
    }

    return generateAuthResponse(user);
}

export async function logout(userId: string): Promise<void> {
    await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
    });
}

export async function getSession(userId: string): Promise<Partial<User>> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });
    if (!user) {
        throw new NotFoundError("User not found");
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
        expiresAt: "",
        issuer: "",
    };

    const accessToken = await generateAccessToken(payload);
    const refreshToken = await generateRefreshToken(payload);

    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
    });

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
