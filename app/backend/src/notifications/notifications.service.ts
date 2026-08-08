import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
  ) {}

  async registerDevice(userId: string, dto: RegisterDeviceDto) {
    const device = await this.prisma.device.upsert({
      where: { pushToken: dto.pushToken },
      update: {
        userId,
        platform: dto.platform,
        lastActiveAt: new Date(),
      },
      create: {
        userId,
        pushToken: dto.pushToken,
        platform: dto.platform,
      },
    });

    return {
      message: 'Device push token registered successfully',
      device,
    };
  }

  async createAndSendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
      },
    });

    // Dispatch real-time WebSocket push notification to user personal room
    this.trackingService.notifyUser(userId, 'notificationReceived', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      createdAt: notification.createdAt,
    });

    // Dispatch Expo Push Notification to registered mobile devices
    this.sendExpoPushNotification(userId, title, body, {
      notificationId: notification.id,
      type: notification.type,
      relatedEntityType,
      relatedEntityId,
    }).catch(() => {});

    return notification;
  }

  private async sendExpoPushNotification(
    userId: string,
    title: string,
    body: string,
    data: any,
  ) {
    const devices = await this.prisma.device.findMany({
      where: { userId },
    });

    if (!devices || devices.length === 0) return;

    const pushPayloads = devices.map((d) => ({
      to: d.pushToken,
      sound: 'default',
      title,
      body,
      data,
    }));

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushPayloads),
      });
    } catch (err) {
      // ignore network errors for background push dispatch
    }
  }


  async getUserNotifications(userId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return {
      unreadCount,
      notifications,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('You can only update your own notifications');
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return {
      message: 'Notification marked as read',
      notification: updatedNotification,
    };
  }
}
