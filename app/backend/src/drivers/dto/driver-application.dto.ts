import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AllowedVehicleCategory {
  MOTORBIKE = 'motorbike',
  CAR = 'car',
}

export class DriverApplicationDto {
  // --- CNIC Info ---
  @IsNotEmpty({ message: 'CNIC number is required' })
  @IsString()
  @Matches(/^(\d{5}-\d{7}-\d{1}|\d{13})$/, {
    message: 'CNIC number must be a valid 13-digit Pakistani CNIC format (e.g. 12345-1234567-1 or 1234512345671)',
  })
  cnicNumber: string;

  @IsNotEmpty({ message: 'Name on CNIC is required' })
  @IsString()
  cnicName: string;

  // --- License Info ---
  @IsNotEmpty({ message: 'License number is required' })
  @IsString()
  licenseNumber: string;

  @IsNotEmpty({ message: 'License expiry date is required' })
  @IsString()
  licenseExpiryDate: string;

  // --- Vehicle Info ---
  @IsNotEmpty({ message: 'Vehicle category is required (motorbike or car)' })
  @IsEnum(AllowedVehicleCategory, {
    message: 'Vehicle category must be either "motorbike" or "car"',
  })
  vehicleCategory: AllowedVehicleCategory;

  @IsNotEmpty({ message: 'Vehicle make is required (e.g., Honda, Toyota)' })
  @IsString()
  vehicleMake: string;

  @IsNotEmpty({ message: 'Vehicle model is required (e.g., CD70, Civic, Corolla)' })
  @IsString()
  vehicleModel: string;

  @IsNotEmpty({ message: 'Vehicle manufacturing year is required' })
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  vehicleYear: number;

  @IsNotEmpty({ message: 'Vehicle color is required' })
  @IsString()
  vehicleColor: string;

  @IsNotEmpty({ message: 'Vehicle license plate number is required' })
  @IsString()
  plateNumber: string;

  @IsNotEmpty({ message: 'Seat capacity is required' })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Seat capacity must be at least 1 seat for passenger' })
  seatCapacity: number;
}
