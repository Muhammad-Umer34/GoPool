import { Injectable } from '@nestjs/common';
import { TrackingGateway } from './tracking.gateway';

@Injectable()
export class TrackingService {
  constructor(private readonly trackingGateway: TrackingGateway) {}

  /**
   * Broadcast ride status updates (e.g. ongoing, completed, cancelled) to all passengers in the ride room
   */
  broadcastRideStatus(rideId: string, status: string, additionalData?: any) {
    const room = `ride_${rideId}`;
    this.trackingGateway.server.to(room).emit('rideStatusChanged', {
      rideId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData,
    });
  }

  /**
   * Send a private notification event to a specific user's socket room (user_<userId>)
   */
  notifyUser(userId: string, eventName: string, payload: any) {
    const room = `user_${userId}`;
    this.trackingGateway.server.to(room).emit(eventName, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send an arbitrary broadcast event to all participants in a ride room (ride_<rideId>)
   */
  broadcastToRideRoom(rideId: string, eventName: string, payload: any) {
    const room = `ride_${rideId}`;
    this.trackingGateway.server.to(room).emit(eventName, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }
}
