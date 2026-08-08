import { IsDateString, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRideDto {
  @IsNotEmpty({ message: 'Origin latitude is required for search' })
  @Type(() => Number)
  @IsLatitude()
  originLat: number;

  @IsNotEmpty({ message: 'Origin longitude is required for search' })
  @Type(() => Number)
  @IsLongitude()
  originLng: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  destinationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  destinationLng?: number;

  @IsOptional()
  @IsDateString()
  departureDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minSeats?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  radiusKm?: number = 10; // Default search radius 10 KM
}
