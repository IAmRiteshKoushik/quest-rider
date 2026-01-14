import { UserRoleEnum } from "../generated/prisma/enums";

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    expiresAt: string;
    issuer: string;
    [key: string]: any;
}

export interface AuthResponse {
    user: {
        id: string;
        email: string;
        name: string;
        role: UserRoleEnum;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
}
