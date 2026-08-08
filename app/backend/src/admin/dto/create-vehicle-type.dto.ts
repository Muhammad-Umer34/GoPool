import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateVehicleTypeDto {
  @IsNotEmpty({ message: 'Vehicle type name is required' })
  @IsString()
  name: string;

  @IsNotEmpty({ message: 'Max passenger capacity is required' })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Max capacity must be at least 1' })
  maxCapacity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Base fare must be non-negative' })
  baseFare?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Per-km rate must be non-negative' })
  perKmRate?: number = 0;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateVehicleTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseFare?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  perKmRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
