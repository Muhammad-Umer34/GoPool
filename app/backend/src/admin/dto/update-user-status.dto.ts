import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserStatusDto {
  @IsNotEmpty({ message: 'User status is required' })
  @IsEnum(UserStatus, { message: 'Status must be active, suspended, banned, or deleted' })
  status: UserStatus;
}
