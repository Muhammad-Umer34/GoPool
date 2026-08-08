import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { LocationUpdateDto } from './dto/location-update.dto';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/tracking',
})
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader =
        client.handshake.headers?.authorization ||
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string);

      let token = '';
      if (authHeader) {
        token = authHeader.replace(/^Bearer\s+/i, '').trim();
      }

      if (!token) {
        this.logger.warn(`Unauthenticated socket connection attempt rejected: ${client.id}`);
        client.disconnect();
        return;
      }

      const secret =
        process.env.JWT_ACCESS_SECRET ||
        'gopool_super_secret_access_key_2026_change_in_prod';

      const payload = await this.jwtService.verifyAsync(token, { secret });
      client.data.user = payload;
      this.logger.log(`Socket authenticated successfully: ${client.id} (User: ${payload.sub})`);
    } catch (err: any) {
      this.logger.warn(`Socket JWT verification failed for ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from tracking namespace: ${client.id}`);
  }

  @SubscribeMessage('joinRideRoom')
  async handleJoinRideRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { rideId: string },
  ) {
    if (!payload?.rideId) return;

    const userId = client.data?.user?.sub;
    if (!userId) {
      return { event: 'error', message: 'Unauthorized socket client' };
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: payload.rideId },
      include: { ridePassengers: true },
    });

    if (!ride) {
      return { event: 'error', message: 'Ride not found' };
    }

    const isDriver = ride.driverId === userId;
    const isPassenger = ride.ridePassengers.some(
      (p) => p.passengerId === userId && p.status !== 'cancelled',
    );

    if (!isDriver && !isPassenger) {
      this.logger.warn(`Unauthorized room join attempt by user ${userId} for ride ${payload.rideId}`);
      return { event: 'error', message: 'Forbidden: You are not a driver or passenger on this trip' };
    }

    const room = `ride_${payload.rideId}`;
    client.join(room);
    this.logger.log(`Socket ${client.id} (User: ${userId}) joined authorized room ${room}`);
    return { event: 'joinedRoom', room };
  }

  @SubscribeMessage('leaveRideRoom')
  handleLeaveRideRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { rideId: string },
  ) {
    if (payload?.rideId) {
      const room = `ride_${payload.rideId}`;
      client.leave(room);
      this.logger.log(`Socket ${client.id} left room ${room}`);
      return { event: 'leftRoom', room };
    }
  }

  @SubscribeMessage('joinUserRoom')
  handleJoinUserRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string },
  ) {
    const authUserId = client.data?.user?.sub;
    if (payload?.userId && payload.userId === authUserId) {
      const room = `user_${payload.userId}`;
      client.join(room);
      this.logger.log(`Socket ${client.id} joined personal user room ${room}`);
      return { event: 'joinedUserRoom', room };
    } else {
      return { event: 'error', message: 'Forbidden: Cannot join another user personal room' };
    }
  }


  @SubscribeMessage('updateLocation')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  handleUpdateLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationUpdateDto,
  ) {
    const room = `ride_${payload.rideId}`;
    const broadcastData = {
      rideId: payload.rideId,
      socketId: client.id,
      lat: payload.lat,
      lng: payload.lng,
      heading: payload.heading || 0,
      speed: payload.speed || 0,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients subscribed to this ride room
    this.server.to(room).emit('driverLocationUpdated', broadcastData);

    return { status: 'acknowledged', broadcastedTo: room };
  }
}
