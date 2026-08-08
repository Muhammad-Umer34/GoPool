import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { RedisService } from '../redis/redis.service';
export declare class AuthService {
    private usersService;
    private jwtService;
    private redisService;
    constructor(usersService: UsersService, jwtService: JwtService, redisService: RedisService);
    validateUser(identifier: string, pass: string): Promise<any>;
    register(registerDto: RegisterDto): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            profile: {
                firstName: string;
                lastName: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                gender: import(".prisma/client").$Enums.GenderType;
                dateOfBirth: Date | null;
                profilePictureUrl: string | null;
                bio: string | null;
                emergencyContactName: string | null;
                emergencyContactPhone: string | null;
                ratingAvg: import("@prisma/client/runtime/library").Decimal;
                totalRidesCompleted: number;
                userId: string;
            };
            email: string | null;
            phoneNumber: string | null;
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            status: import(".prisma/client").$Enums.UserStatus;
            isPhoneVerified: boolean;
            isEmailVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
            lastLoginAt: Date | null;
        };
    }>;
    login(user: any): Promise<{
        access_token: string;
        refresh_token: string;
        user: any;
    }>;
    generateTokens(userId: string, email?: string | null, phoneNumber?: string | null, role?: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    updateRefreshTokenHash(userId: string, refreshToken: string): Promise<void>;
    refreshTokens(userId: string, refreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(userId: string, accessToken?: string): Promise<{
        message: string;
    }>;
}
