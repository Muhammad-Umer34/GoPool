import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { SearchRideDto } from './dto/search-ride.dto';
import { RideStatus } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(private readonly prisma: PrismaService) {}

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

    // 4. Create Ride
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
      ride,
    };
  }

  async searchRides(dto: SearchRideDto) {
    const minSeats = dto.minSeats || 1;
    const radiusKm = dto.radiusKm || 10;

    // Fetch all scheduled rides with sufficient seats
    const rides = await this.prisma.ride.findMany({
      where: {
        status: RideStatus.scheduled,
        availableSeats: { gte: minSeats },
        departureTime: { gte: new Date() },
      },
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

    // Filter rides using Haversine formula
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

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.cancelled },
    });

    return {
      message: 'Ride cancelled successfully',
      ride: updatedRide,
    };
  }
}
