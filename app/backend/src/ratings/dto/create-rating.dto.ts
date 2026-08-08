import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRatingDto {
  @IsNotEmpty({ message: 'Ride ID is required' })
  @IsUUID('4', { message: 'Ride ID must be a valid UUID' })
  rideId: string;

  @IsNotEmpty({ message: 'Ratee ID (user being rated) is required' })
  @IsUUID('4', { message: 'Ratee ID must be a valid UUID' })
  rateeId: string;

  @IsNotEmpty({ message: 'Rating value is required' })
  @Type(() => Number)
  @IsInt({ message: 'Rating value must be an integer' })
  @Min(1, { message: 'Rating value must be at least 1' })
  @Max(5, { message: 'Rating value cannot exceed 5' })
  ratingValue: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
