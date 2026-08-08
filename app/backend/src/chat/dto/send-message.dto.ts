import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @IsOptional()
  @IsUUID('4', { message: 'Chat ID must be a valid UUID' })
  chatId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Ride ID must be a valid UUID' })
  rideId?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MessageType, { message: 'Message type must be text, image, location, or system' })
  messageType?: MessageType = MessageType.text;

  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
