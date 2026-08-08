import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationUpdateDto {
  @IsNotEmpty({ message: 'Ride ID is required' })
  @IsUUID('4', { message: 'Ride ID must be a valid UUID' })
  rideId: string;

  @IsNotEmpty({ message: 'Latitude is required' })
  @Type(() => Number)
  @IsLatitude({ message: 'Latitude must be between -90 and 90' })
  lat: number;

  @IsNotEmpty({ message: 'Longitude is required' })
  @Type(() => Number)
  @IsLongitude({ message: 'Longitude must be between -180 and 180' })
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Heading must be at least 0' })
  @Max(360, { message: 'Heading cannot exceed 360' })
  heading?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Speed must be non-negative' })
  speed?: number;
}
