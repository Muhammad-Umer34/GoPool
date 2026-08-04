import { Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.type';
import { UsersService } from '../../users/users.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private usersService;
    constructor(usersService: UsersService);
    validate(payload: JwtPayload): Promise<{
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
}
export {};
