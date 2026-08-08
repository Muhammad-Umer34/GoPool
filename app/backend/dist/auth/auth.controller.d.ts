import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    login(user: any, _loginDto: LoginDto): Promise<{
        access_token: string;
        refresh_token: string;
        user: any;
    }>;
    refreshTokens(user: any): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
    logout(userId: string, req: any): Promise<{
        message: string;
    }>;
    getProfile(user: any): Promise<any>;
}
