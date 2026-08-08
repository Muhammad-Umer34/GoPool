import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { SearchRideDto } from './dto/search-ride.dto';
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RespondRideRequestDto, ResponseActionStatus } from './dto/respond-ride-request.dto';
import { RideStatus, RideRequestStatus, RidePassengerStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrackingService } from '../tracking/tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingService: TrackingService,
    private readonly notificationsService: NotificationsService,
  ) {}



  // Helper method: Calculate distance between two lat/lng coordinates in kilometers using Haversine formula
  private haversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async createRide(driverId: string, dto: CreateRideDto) {
    // 1. Departure time must be in the future
    const depTime = new Date(dto.departureTime);
    if (depTime <= new Date()) {
      throw new BadRequestException('Departure time must be in the future');
    }

    // 2. Find driver's verified vehicle
    let vehicle = null;
    if (dto.vehicleId) {
      vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, driverId, isVerified: true },
      });
    } else {
      vehicle = await this.prisma.vehicle.findFirst({
        where: { driverId, isVerified: true, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!vehicle) {
      throw new ForbiddenException(
        'You must have an approved & verified vehicle to create a ride.',
      );
    }

    // 3. Check seat capacity against vehicle capacity
    if (dto.availableSeats > vehicle.seatCapacity) {
      throw new BadRequestException(
        `Available seats (${dto.availableSeats}) cannot exceed registered vehicle capacity (${vehicle.seatCapacity} passenger seats).`,
      );
    }

    // 4. Validate Price Per Seat pricing bounds against vehicle type baseFare & perKmRate
    const distKm = this.haversineDistanceKm(
      dto.originLat,
      dto.originLng,
      dto.destinationLat,
      dto.destinationLng,
    );

    const baseFare = Number(vehicle.vehicleType?.baseFare) || 50;
    const perKmRate = Number(vehicle.vehicleType?.perKmRate) || 20;
    const estimatedTotalTripFare = baseFare + perKmRate * distKm;
    const recommendedPricePerSeat = Math.max(
      30,
      Math.round(estimatedTotalTripFare / (dto.availableSeats || 1)),
    );

    const minPrice = Math.max(10, Math.floor(recommendedPricePerSeat * 0.4));
    const maxPrice = Math.ceil(recommendedPricePerSeat * 3.5);

    if (dto.pricePerSeat < minPrice || dto.pricePerSeat > maxPrice) {
      throw new BadRequestException(
        `pricePerSeat (${dto.pricePerSeat} PKR) is out of recommended bounds for ${vehicle.vehicleType?.name || 'this vehicle'} (Estimated: ~${recommendedPricePerSeat} PKR per seat; Allowed bounds: ${minPrice} - ${maxPrice} PKR).`,
      );
    }

    // 5. Create Ride
    const ride = await this.prisma.ride.create({
      data: {
        driverId,
        vehicleId: vehicle.id,
        originAddress: dto.originAddress,
        originLat: dto.originLat,
        originLng: dto.originLng,
        destinationAddress: dto.destinationAddress,
        destinationLat: dto.destinationLat,
        destinationLng: dto.destinationLng,
        departureTime: depTime,
        estimatedArrivalTime: dto.estimatedArrivalTime
          ? new Date(dto.estimatedArrivalTime)
          : null,
        availableSeats: dto.availableSeats,
        pricePerSeat: dto.pricePerSeat,
        routePolyline: dto.routePolyline || null,
        status: RideStatus.scheduled,
      },
      include: {
        driver: {
          include: { profile: true },
        },
        vehicle: {
          include: { vehicleType: true },
        },
      },
    });

    return {
      message: 'Ride offered successfully',
      recommendedPricePerSeat,
      ride,
    };
  }


  async searchRides(dto: SearchRideDto) {
    const minSeats = dto.minSeats || 1;
    const radiusKm = dto.radiusKm || 10;

    // Calculate SQL Bounding Box for origin coordinates to filter in DB index
    const deltaLat = radiusKm / 111;
    const cosLat = Math.cos((dto.originLat * Math.PI) / 180);
    const deltaLng = radiusKm / (111 * (Math.abs(cosLat) > 0.01 ? Math.abs(cosLat) : 1));

    const minLat = dto.originLat - deltaLat;
    const maxLat = dto.originLat + deltaLat;
    const minLng = dto.originLng - deltaLng;
    const maxLng = dto.originLng + deltaLng;

    const whereCondition: any = {
      status: RideStatus.scheduled,
      availableSeats: { gte: minSeats },
      departureTime: { gte: new Date() },
      originLat: { gte: minLat, lte: maxLat },
      originLng: { gte: minLng, lte: maxLng },
    };

    // If destination filter is requested, compute bounding box for destination
    if (dto.destinationLat !== undefined && dto.destinationLng !== undefined) {
      const destDeltaLat = radiusKm / 111;
      const destCosLat = Math.cos((dto.destinationLat * Math.PI) / 180);
      const destDeltaLng = radiusKm / (111 * (Math.abs(destCosLat) > 0.01 ? Math.abs(destCosLat) : 1));

      whereCondition.destinationLat = {
        gte: dto.destinationLat - destDeltaLat,
        lte: dto.destinationLat + destDeltaLat,
      };
      whereCondition.destinationLng = {
        gte: dto.destinationLng - destDeltaLng,
        lte: dto.destinationLng + destDeltaLng,
      };
    }

    // Query database with spatial bounding box index filter
    const rides = await this.prisma.ride.findMany({
      where: whereCondition,
      include: {
        driver: {
          include: { profile: true },
        },
        vehicle: {
          include: { vehicleType: true },
        },
      },
      orderBy: { departureTime: 'asc' },
    });

    // Precise fine-grain Haversine filter on pre-filtered result set
    const filteredRides = rides.filter((ride) => {
      const originDist = this.haversineDistanceKm(
        dto.originLat,
        dto.originLng,
        Number(ride.originLat),
        Number(ride.originLng),
      );

      if (originDist > radiusKm) {
        return false;
      }

      if (dto.destinationLat !== undefined && dto.destinationLng !== undefined) {
        const destDist = this.haversineDistanceKm(
          dto.destinationLat,
          dto.destinationLng,
          Number(ride.destinationLat),
          Number(ride.destinationLng),
        );
        if (destDist > radiusKm) {
          return false;
        }
      }

      if (dto.departureDate) {
        const searchDateStr = new Date(dto.departureDate).toISOString().split('T')[0];
        const rideDateStr = new Date(ride.departureTime).toISOString().split('T')[0];
        if (searchDateStr !== rideDateStr) {
          return false;
        }
      }

      return true;
    });


    return {
      totalFound: filteredRides.length,
      searchRadiusKm: radiusKm,
      rides: filteredRides.map((ride) => {
        const distFromOrigin = this.haversineDistanceKm(
          dto.originLat,
          dto.originLng,
          Number(ride.originLat),
          Number(ride.originLng),
        );
        return {
          ...ride,
          distanceFromOriginKm: Math.round(distFromOrigin * 100) / 100,
        };
      }),
    };
  }

  async getMyOfferedRides(driverId: string) {
    return this.prisma.ride.findMany({
      where: { driverId },
      include: {
        vehicle: true,
        ridePassengers: true,
      },
      orderBy: { departureTime: 'desc' },
    });
  }

  async getRideById(rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        driver: {
          include: { profile: true },
        },
        vehicle: {
          include: { vehicleType: true },
        },
        ridePassengers: true,
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return ride;
  }

  async cancelRide(driverId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { ridePassengers: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== driverId) {
      throw new ForbiddenException('You can only cancel your own offered rides');
    }

    if (ride.status === RideStatus.completed || ride.status === RideStatus.cancelled) {
      throw new BadRequestException(`Ride is already ${ride.status}`);
    }

    const updatedRide = await this.prisma.$transaction(async (tx) => {
      // 1. Update Ride status to cancelled
      const cancelledRide = await tx.ride.update({
        where: { id: rideId },
        data: { status: RideStatus.cancelled },
      });

      // 2. Update active passenger records to cancelled
      await tx.ridePassenger.updateMany({
        where: {
          rideId,
          status: { in: [RidePassengerStatus.confirmed, RidePassengerStatus.picked_up] },
        },
        data: { status: RidePassengerStatus.cancelled },
      });

      return cancelledRide;
    });

    // Broadcast WebSocket event to ride room
    this.trackingService.broadcastRideStatus(rideId, RideStatus.cancelled);

    // Notify all affected passengers via push notifications
    for (const passenger of ride.ridePassengers) {
      if (
        passenger.status === RidePassengerStatus.confirmed ||
        passenger.status === RidePassengerStatus.picked_up
      ) {
        this.notificationsService.createAndSendNotification(
          passenger.passengerId,
          NotificationType.ride_cancelled,
          'Ride Cancelled by Driver',
          `Your driver has cancelled the ride from ${ride.originAddress} to ${ride.destinationAddress}.`,
          'Ride',
          rideId,
        );
      }
    }

    return {
      message: 'Ride cancelled successfully and passengers notified',
      ride: updatedRide,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireStaleRequests() {
    const result = await this.prisma.rideRequest.updateMany({
      where: {
        status: RideRequestStatus.pending,
        ride: {
          departureTime: { lt: new Date() },
        },
      },
      data: { status: RideRequestStatus.expired },
    });

    if (result.count > 0) {
      console.log(`[Cron] Automatically expired ${result.count} stale unresponded ride requests.`);
    }
  }


  // ==========================================
  // Ride Booking & Request Lifecycle Methods
  // ==========================================

  async createRideRequest(passengerId: string, rideId: string, dto: CreateRideRequestDto) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== RideStatus.scheduled) {
      throw new BadRequestException(`Cannot request to join a ride that is ${ride.status}`);
    }

    if (ride.driverId === passengerId) {
      throw new BadRequestException('Drivers cannot request to join their own ride');
    }

    const seatsRequested = dto.seatsRequested || 1;

    if (ride.availableSeats < seatsRequested) {
      throw new BadRequestException(
        `Requested seats (${seatsRequested}) exceeds available seats (${ride.availableSeats})`,
      );
    }

    const existingRequest = await this.prisma.rideRequest.findFirst({
      where: {
        rideId,
        passengerId,
        status: { in: [RideRequestStatus.pending, RideRequestStatus.accepted] },
      },
    });

    if (existingRequest) {
      throw new BadRequestException(
        `You already have an active request (${existingRequest.status}) for this ride`,
      );
    }

    const request = await this.prisma.rideRequest.create({
      data: {
        rideId,
        passengerId,
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffAddress: dto.dropoffAddress,
        dropoffLat: dto.dropoffLat,
        dropoffLng: dto.dropoffLng,
        seatsRequested,
        status: RideRequestStatus.pending,
      },
      include: {
        ride: {
          include: { driver: { include: { profile: true } } },
        },
      },
    });

    return {
      message: 'Ride request submitted successfully',
      request,
    };
  }

  async respondRideRequest(driverId: string, requestId: string, dto: RespondRideRequestDto) {
    const rideRequest = await this.prisma.rideRequest.findUnique({
      where: { id: requestId },
      include: { ride: true },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.ride.driverId !== driverId) {
      throw new ForbiddenException('You can only respond to requests for your own offered rides');
    }

    if (rideRequest.status !== RideRequestStatus.pending) {
      throw new BadRequestException(
        `Ride request has already been ${rideRequest.status}`,
      );
    }

    if (dto.status === ResponseActionStatus.REJECTED) {
      const updatedRequest = await this.prisma.rideRequest.update({
        where: { id: requestId },
        data: {
          status: RideRequestStatus.rejected,
          respondedAt: new Date(),
        },
      });

      return {
        message: 'Ride request rejected',
        request: updatedRequest,
      };
    }

    // Process Acceptance via atomic transaction
    return this.prisma.$transaction(async (tx) => {
      const currentRide = await tx.ride.findUnique({
        where: { id: rideRequest.rideId },
      });

      if (!currentRide || currentRide.availableSeats < rideRequest.seatsRequested) {
        throw new BadRequestException(
          'Not enough available seats remaining to accept this request',
        );
      }

      // 1. Decrement available seats
      await tx.ride.update({
        where: { id: currentRide.id },
        data: {
          availableSeats: { decrement: rideRequest.seatsRequested },
        },
      });

      // 2. Update RideRequest status
      const updatedRequest = await tx.rideRequest.update({
        where: { id: requestId },
        data: {
          status: RideRequestStatus.accepted,
          respondedAt: new Date(),
        },
      });

      // 3. Generate 4-digit pickup OTP PIN & create RidePassenger record
      const pickupOtpPin = Math.floor(1000 + Math.random() * 9000).toString();
      const fareAmount = Number(currentRide.pricePerSeat) * rideRequest.seatsRequested;

      const passengerRecord = await tx.ridePassenger.create({
        data: {
          rideId: currentRide.id,
          rideRequestId: requestId,
          passengerId: rideRequest.passengerId,
          seatCount: rideRequest.seatsRequested,
          pickupPoint: rideRequest.pickupAddress,
          dropoffPoint: rideRequest.dropoffAddress,
          fareAmount,
          pickupOtpPin,
          status: RidePassengerStatus.confirmed,
        },
      });

      // Send Push notification with PIN to passenger
      this.notificationsService.createAndSendNotification(
        rideRequest.passengerId,
        NotificationType.ride_accepted,
        'Ride Booking Accepted!',
        `Your driver accepted your booking! Your pickup OTP PIN is: ${pickupOtpPin}`,
        'Ride',
        currentRide.id,
      );

      return {
        message: 'Ride request accepted successfully',
        pickupOtpPin,
        request: updatedRequest,
        passengerRecord,
      };
    });
  }


  async cancelRideRequest(userId: string, requestId: string) {
    const rideRequest = await this.prisma.rideRequest.findUnique({
      where: { id: requestId },
      include: { ride: true, ridePassenger: true },
    });

    if (!rideRequest) {
      throw new NotFoundException('Ride request not found');
    }

    if (rideRequest.passengerId !== userId) {
      throw new ForbiddenException('You can only cancel your own ride requests');
    }

    if (
      rideRequest.status === RideRequestStatus.cancelled ||
      rideRequest.status === RideRequestStatus.rejected
    ) {
      throw new BadRequestException(`Ride request is already ${rideRequest.status}`);
    }

    if (rideRequest.status === RideRequestStatus.accepted) {
      return this.prisma.$transaction(async (tx) => {
        // 1. Restore available seats
        await tx.ride.update({
          where: { id: rideRequest.rideId },
          data: {
            availableSeats: { increment: rideRequest.seatsRequested },
          },
        });

        // 2. Update RideRequest
        const updatedRequest = await tx.rideRequest.update({
          where: { id: requestId },
          data: { status: RideRequestStatus.cancelled },
        });

        // 3. Update RidePassenger record if exists
        if (rideRequest.ridePassenger) {
          await tx.ridePassenger.update({
            where: { id: rideRequest.ridePassenger.id },
            data: { status: RidePassengerStatus.cancelled },
          });
        }

        return {
          message: 'Booking cancelled and seats released successfully',
          request: updatedRequest,
        };
      });
    }

    // Pending status cancellation
    const updatedRequest = await this.prisma.rideRequest.update({
      where: { id: requestId },
      data: { status: RideRequestStatus.cancelled },
    });

    return {
      message: 'Ride request cancelled successfully',
      request: updatedRequest,
    };
  }

  async getMyBookings(passengerId: string) {
    return this.prisma.rideRequest.findMany({
      where: { passengerId },
      include: {
        ride: {
          include: {
            driver: { include: { profile: true } },
            vehicle: true,
          },
        },
        ridePassenger: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async getRideRequestsForDriver(driverId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== driverId) {
      throw new ForbiddenException('You can only view requests for your own rides');
    }

    return this.prisma.rideRequest.findMany({
      where: { rideId },
      include: {
        passenger: { include: { profile: true } },
        ridePassenger: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  // ==========================================
  // Ride Execution Lifecycle Methods
  // ==========================================

  async startRide(driverId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== driverId) {
      throw new ForbiddenException('You can only start your own offered rides');
    }

    if (ride.status !== RideStatus.scheduled) {
      throw new BadRequestException(`Cannot start a ride that is ${ride.status}`);
    }

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.ongoing },
    });

    this.trackingService.broadcastRideStatus(rideId, RideStatus.ongoing);

    return {
      message: 'Ride started successfully',
      ride: updatedRide,
    };
  }

  async pickupPassenger(driverId: string, passengerRecordId: string, otpPin?: string) {
    const ridePassenger = await this.prisma.ridePassenger.findUnique({
      where: { id: passengerRecordId },
      include: { ride: true },
    });

    if (!ridePassenger) {
      throw new NotFoundException('Passenger booking record not found');
    }

    if (ridePassenger.ride.driverId !== driverId) {
      throw new ForbiddenException('You can only update passenger status for your own rides');
    }

    if (ridePassenger.ride.status !== RideStatus.ongoing) {
      throw new BadRequestException('Ride must be ongoing to pick up passengers');
    }

    if (ridePassenger.status === RidePassengerStatus.picked_up) {
      throw new BadRequestException('Passenger is already marked as picked up');
    }

    if (ridePassenger.pickupOtpPin && ridePassenger.pickupOtpPin !== otpPin) {
      throw new BadRequestException(
        `Invalid pickup OTP PIN (${otpPin || 'none'}). Please ask the passenger for their 4-digit PIN.`,
      );
    }

    const updatedRecord = await this.prisma.ridePassenger.update({
      where: { id: passengerRecordId },
      data: { status: RidePassengerStatus.picked_up },
    });

    this.trackingService.notifyUser(
      ridePassenger.passengerId,
      'passengerPickedUp',
      { rideId: ridePassenger.rideId, passengerRecordId },
    );

    return {
      message: 'Passenger verified & marked as picked up successfully',
      passenger: updatedRecord,
    };
  }


  async completeRide(driverId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { ridePassengers: true },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== driverId) {
      throw new ForbiddenException('You can only complete your own offered rides');
    }

    if (ride.status !== RideStatus.ongoing) {
      throw new BadRequestException(`Cannot complete a ride that is ${ride.status}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update Ride status to completed
      const completedRide = await tx.ride.update({
        where: { id: rideId },
        data: { status: RideStatus.completed },
      });

      // 2. Find all active passengers (confirmed or picked_up)
      const activePassengers = await tx.ridePassenger.findMany({
        where: {
          rideId,
          status: { in: [RidePassengerStatus.confirmed, RidePassengerStatus.picked_up] },
        },
      });

      // 3. Mark active passengers as completed
      if (activePassengers.length > 0) {
        await tx.ridePassenger.updateMany({
          where: {
            rideId,
            status: { in: [RidePassengerStatus.confirmed, RidePassengerStatus.picked_up] },
          },
          data: {
            status: RidePassengerStatus.completed,
            completedAt: new Date(),
          },
        });

        // 4. Increment totalRidesCompleted for each completed passenger
        for (const passenger of activePassengers) {
          await tx.profile.updateMany({
            where: { userId: passenger.passengerId },
            data: { totalRidesCompleted: { increment: 1 } },
          });
        }
      }

      // 5. Increment totalRidesCompleted for driver
      await tx.profile.updateMany({
        where: { userId: driverId },
        data: { totalRidesCompleted: { increment: 1 } },
      });

      return {
        message: 'Ride completed successfully',
        ride: completedRide,
        completedPassengersCount: activePassengers.length,
      };
    });

    this.trackingService.broadcastRideStatus(rideId, RideStatus.completed);

    return result;
  }

}


