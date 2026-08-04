import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    create(createUserDto: CreateUserDto, passwordHash: string): Promise<{
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
    } & {
        email: string | null;
        phoneNumber: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        passwordHash: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        refreshTokenHash: string | null;
    }>;
    findById(id: string): Promise<{
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
    } & {
        email: string | null;
        phoneNumber: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        passwordHash: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        refreshTokenHash: string | null;
    }>;
    findByEmailOrPhone(identifier: string): Promise<{
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
    } & {
        email: string | null;
        phoneNumber: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        passwordHash: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        refreshTokenHash: string | null;
    }>;
    updateRefreshTokenHash(userId: string, refreshTokenHash: string | null): Promise<{
        email: string | null;
        phoneNumber: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        passwordHash: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        refreshTokenHash: string | null;
    }>;
    updateLastLogin(userId: string): Promise<{
        email: string | null;
        phoneNumber: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        passwordHash: string | null;
        status: import(".prisma/client").$Enums.UserStatus;
        isPhoneVerified: boolean;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
        lastLoginAt: Date | null;
        refreshTokenHash: string | null;
    }>;
}
