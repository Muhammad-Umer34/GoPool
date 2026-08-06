import { IsNotEmpty, IsString } from 'class-validator';

export class RejectDriverDto {
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @IsString()
  reason: string;
}
