import { IsEnum, IsNotEmpty } from 'class-validator';

export enum ResponseActionStatus {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export class RespondRideRequestDto {
  @IsNotEmpty({ message: 'Status decision is required (accepted or rejected)' })
  @IsEnum(ResponseActionStatus, {
    message: 'Status must be either accepted or rejected',
  })
  status: ResponseActionStatus;
}
