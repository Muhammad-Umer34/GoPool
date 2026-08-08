import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('my-chats')
  async getUserChats(@CurrentUser() user: JwtPayload) {
    return this.chatService.getUserChats(user.sub);
  }

  @Get('ride/:rideId')
  async getOrCreateRideChat(
    @CurrentUser() user: JwtPayload,
    @Param('rideId') rideId: string,
  ) {
    return this.chatService.getOrCreateRideChat(user.sub, rideId);
  }

  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.sub, dto);
  }

  @Get(':chatId/messages')
  async getChatMessages(
    @CurrentUser() user: JwtPayload,
    @Param('chatId') chatId: string,
  ) {
    return this.chatService.getChatMessages(user.sub, chatId);
  }
}
