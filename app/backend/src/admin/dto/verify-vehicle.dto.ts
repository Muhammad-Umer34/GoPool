import { IsBoolean, IsNotEmpty } from 'class-validator';

export class VerifyVehicleDto {
  @IsNotEmpty({ message: 'isVerified flag is required' })
  @IsBoolean({ message: 'isVerified must be a boolean' })
  isVerified: boolean;
}
