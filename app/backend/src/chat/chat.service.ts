import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatType, MessageType, RidePassengerStatus } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
  ) {}

  async getOrCreateRideChat(userId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { ridePassengers: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    const isDriver = ride.driverId === userId;
    const passengerRecord = ride.ridePassengers.find(
      (p) =>
        p.passengerId === userId &&
        (
          [
            RidePassengerStatus.confirmed,
            RidePassengerStatus.picked_up,
            RidePassengerStatus.completed,
          ] as RidePassengerStatus[]
        ).includes(p.status),
    );


    if (!isDriver && !passengerRecord) {
      throw new ForbiddenException(
        'You must be an active passenger or driver of this ride to join its chat',
      );
    }

    // Find existing chat or create
    let chat = await this.prisma.chat.findUnique({
      where: { rideId },
      include: {
        participants: { include: { user: { include: { profile: true } } } },
      },
    });

    if (!chat) {
      chat = await this.prisma.chat.create({
        data: {
          rideId,
          type: ChatType.ride_group,
          participants: {
            create: {
              userId: ride.driverId,
            },
          },
        },
        include: {
          participants: { include: { user: { include: { profile: true } } } },
        },
      });
    }

    // Ensure current user is in participants
    const isParticipant = chat.participants.some((p) => p.userId === userId);
    if (!isParticipant) {
      await this.prisma.chatParticipant.create({
        data: {
          chatId: chat.id,
          userId,
        },
      });
    }

    return this.prisma.chat.findUnique({
      where: { id: chat.id },
      include: {
        ride: true,
        participants: { include: { user: { include: { profile: true } } } },
        messages: {
          include: { sender: { include: { profile: true } } },
          orderBy: { sentAt: 'asc' },
          take: 50,
        },
      },
    });
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    if (!dto.content && !dto.mediaUrl) {
      throw new BadRequestException('Message must contain either text content or media URL');
    }

    let targetChatId = dto.chatId;

    if (!targetChatId && dto.rideId) {
      const chat = await this.getOrCreateRideChat(senderId, dto.rideId);
      targetChatId = chat.id;
    }

    if (!targetChatId) {
      throw new BadRequestException('Either chatId or rideId must be provided');
    }

    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId: targetChatId,
          userId: senderId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    const message = await this.prisma.message.create({
      data: {
        chatId: targetChatId,
        senderId,
        content: dto.content || null,
        messageType: dto.messageType || MessageType.text,
        mediaUrl: dto.mediaUrl || null,
      },
      include: {
        sender: { include: { profile: true } },
        chat: true,
      },
    });

    const broadcastPayload = {
      messageId: message.id,
      chatId: message.chatId,
      senderId: message.senderId,
      senderName: `${message.sender.profile?.firstName || ''} ${message.sender.profile?.lastName || ''}`.trim(),
      content: message.content,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      sentAt: message.sentAt,
    };

    // Broadcast message over WebSockets to ride room if associated with a ride
    if (message.chat.rideId) {
      this.trackingService.broadcastToRideRoom(
        message.chat.rideId,
        'newMessage',
        broadcastPayload,
      );
    }

    return {
      message: 'Message sent successfully',
      data: message,
    };
  }

  async getChatMessages(userId: string, chatId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    return this.prisma.message.findMany({
      where: { chatId },
      include: {
        sender: { include: { profile: true } },
      },
      orderBy: { sentAt: 'asc' },
    });
  }

  async getUserChats(userId: string) {
    return this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        chat: {
          include: {
            ride: true,
            participants: { include: { user: { include: { profile: true } } } },
            messages: {
              orderBy: { sentAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }
}
