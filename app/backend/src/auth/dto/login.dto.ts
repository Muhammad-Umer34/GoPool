import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string; // email or phone number

  @IsString()
  @IsNotEmpty()
  password!: string;
}
