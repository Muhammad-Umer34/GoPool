import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRideRequestDto {
  @IsNotEmpty({ message: 'Pickup address is required' })
  @IsString()
  pickupAddress: string;

  @IsNotEmpty({ message: 'Pickup latitude is required' })
  @Type(() => Number)
  @IsLatitude({ message: 'Pickup latitude must be a valid latitude (-90 to 90)' })
  pickupLat: number;

  @IsNotEmpty({ message: 'Pickup longitude is required' })
  @Type(() => Number)
  @IsLongitude({ message: 'Pickup longitude must be a valid longitude (-180 to 180)' })
  pickupLng: number;

  @IsNotEmpty({ message: 'Dropoff address is required' })
  @IsString()
  dropoffAddress: string;

  @IsNotEmpty({ message: 'Dropoff latitude is required' })
  @Type(() => Number)
  @IsLatitude({ message: 'Dropoff latitude must be a valid latitude (-90 to 90)' })
  dropoffLat: number;

  @IsNotEmpty({ message: 'Dropoff longitude is required' })
  @Type(() => Number)
  @IsLongitude({ message: 'Dropoff longitude must be a valid longitude (-180 to 180)' })
  dropoffLng: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Seats requested must be at least 1' })
  @Max(10, { message: 'Seats requested cannot exceed 10' })
  seatsRequested?: number = 1;
}
