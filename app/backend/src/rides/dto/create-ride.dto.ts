import {
  IsDateString,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRideDto {
  @IsOptional()
  @IsUUID('4', { message: 'Vehicle ID must be a valid UUID' })
  vehicleId?: string;

  @IsNotEmpty({ message: 'Origin address is required' })
  @IsString()
  originAddress: string;

  @IsNotEmpty({ message: 'Origin latitude is required' })
  @Type(() => Number)
  @IsLatitude({ message: 'Origin latitude must be a valid latitude between -90 and 90' })
  originLat: number;

  @IsNotEmpty({ message: 'Origin longitude is required' })
  @Type(() => Number)
  @IsLongitude({ message: 'Origin longitude must be a valid longitude between -180 and 180' })
  originLng: number;

  @IsNotEmpty({ message: 'Destination address is required' })
  @IsString()
  destinationAddress: string;

  @IsNotEmpty({ message: 'Destination latitude is required' })
  @Type(() => Number)
  @IsLatitude({ message: 'Destination latitude must be a valid latitude between -90 and 90' })
  destinationLat: number;

  @IsNotEmpty({ message: 'Destination longitude is required' })
  @Type(() => Number)
  @IsLongitude({ message: 'Destination longitude must be a valid longitude between -180 and 180' })
  destinationLng: number;

  @IsNotEmpty({ message: 'Departure time is required' })
  @IsDateString({}, { message: 'Departure time must be a valid ISO date string' })
  departureTime: string;

  @IsOptional()
  @IsDateString({}, { message: 'Estimated arrival time must be a valid ISO date string' })
  estimatedArrivalTime?: string;

  @IsNotEmpty({ message: 'Available seats count is required' })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Available seats must be at least 1' })
  availableSeats: number;

  @IsNotEmpty({ message: 'Price per seat is required' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Price per seat must be greater than or equal to 0' })
  pricePerSeat: number;

  @IsOptional()
  @IsString()
  routePolyline?: string;
}
