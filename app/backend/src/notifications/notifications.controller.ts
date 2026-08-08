import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('devices')
  @HttpCode(HttpStatus.CREATED)
  async registerDevice(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.notificationsService.registerDevice(user.sub, dto);
  }

  @Get()
  async getUserNotifications(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUserNotifications(user.sub);
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser() user: JwtPayload,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markAsRead(user.sub, notificationId);
  }
}
