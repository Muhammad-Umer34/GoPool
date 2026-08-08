import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class RegisterDeviceDto {
  @IsNotEmpty({ message: 'Push token is required' })
  @IsString()
  pushToken: string;

  @IsNotEmpty({ message: 'Platform is required (android, ios, or web)' })
  @IsEnum(DevicePlatform, { message: 'Platform must be android, ios, or web' })
  platform: DevicePlatform;
}
