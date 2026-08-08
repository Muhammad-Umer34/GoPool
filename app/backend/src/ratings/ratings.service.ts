import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RideStatus, RidePassengerStatus } from '@prisma/client';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRating(raterId: string, dto: CreateRatingDto) {
    if (raterId === dto.rateeId) {
      throw new BadRequestException('You cannot rate yourself');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: dto.rideId },
      include: {
        ridePassengers: true,
      },
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== RideStatus.completed) {
      throw new BadRequestException('You can only rate participants of a completed ride');
    }

    // Verify participation of both rater and ratee
    const isRaterDriver = ride.driverId === raterId;
    const isRateeDriver = ride.driverId === dto.rateeId;

    const raterPassenger = ride.ridePassengers.find(
      (p) => p.passengerId === raterId && p.status === RidePassengerStatus.completed,
    );
    const rateePassenger = ride.ridePassengers.find(
      (p) => p.passengerId === dto.rateeId && p.status === RidePassengerStatus.completed,
    );

    const isRaterParticipant = isRaterDriver || Boolean(raterPassenger);
    const isRateeParticipant = isRateeDriver || Boolean(rateePassenger);

    if (!isRaterParticipant) {
      throw new ForbiddenException('You were not a completed participant in this ride');
    }

    if (!isRateeParticipant) {
      throw new BadRequestException('The user being rated was not a completed participant in this ride');
    }

    // Prevent duplicate ratings for the same ride and ratee
    const existingRating = await this.prisma.rating.findFirst({
      where: {
        rideId: dto.rideId,
        raterId,
        rateeId: dto.rateeId,
      },
    });

    if (existingRating) {
      throw new BadRequestException('You have already submitted a rating for this user on this ride');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create rating record
      const rating = await tx.rating.create({
        data: {
          rideId: dto.rideId,
          raterId,
          rateeId: dto.rateeId,
          ratingValue: dto.ratingValue,
          comment: dto.comment || null,
        },
      });

      // 2. Recalculate average rating for ratee
      const aggregateResult = await tx.rating.aggregate({
        where: { rateeId: dto.rateeId },
        _avg: { ratingValue: true },
      });

      const newAvgRating = aggregateResult._avg.ratingValue || 5.00;

      // 3. Update ratee profile ratingAvg
      await tx.profile.updateMany({
        where: { userId: dto.rateeId },
        data: { ratingAvg: newAvgRating },
      });

      return {
        message: 'Rating submitted successfully',
        rating,
        updatedRatingAvg: Math.round(newAvgRating * 100) / 100,
      };
    });
  }

  async getUserRatings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ratings = await this.prisma.rating.findMany({
      where: { rateeId: userId },
      include: {
        rater: {
          include: { profile: true },
        },
        ride: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      userId,
      totalRatings: ratings.length,
      ratings: ratings.map((r) => ({
        id: r.id,
        ratingValue: r.ratingValue,
        comment: r.comment,
        createdAt: r.createdAt,
        rater: {
          id: r.rater.id,
          firstName: r.rater.profile?.firstName,
          lastName: r.rater.profile?.lastName,
          profilePictureUrl: r.rater.profile?.profilePictureUrl,
        },
        rideId: r.rideId,
      })),
    };
  }
}
