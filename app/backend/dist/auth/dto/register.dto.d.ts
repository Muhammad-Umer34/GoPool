import { UserRole } from '../../common/enums/user-role.enum';
export declare class RegisterDto {
    email: string;
    phoneNumber?: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: UserRole;
}
