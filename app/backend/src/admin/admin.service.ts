import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { VerifyVehicleDto } from './dto/verify-vehicle.dto';
import { CreateVehicleTypeDto, UpdateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { DocumentStatus, RideStatus, UserRole, UserStatus, ReportStatus, RidePassengerStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalRiders,
      totalDrivers,
      totalAdmins,
      totalRides,
      scheduledRides,
      ongoingRides,
      completedRides,
      cancelledRides,
      pendingDocuments,
      pendingVehicles,
      openReports,
      revenueAggregate,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.rider } }),
      this.prisma.user.count({ where: { role: UserRole.driver } }),
      this.prisma.user.count({ where: { role: UserRole.admin } }),
      this.prisma.ride.count(),
      this.prisma.ride.count({ where: { status: RideStatus.scheduled } }),
      this.prisma.ride.count({ where: { status: RideStatus.ongoing } }),
      this.prisma.ride.count({ where: { status: RideStatus.completed } }),
      this.prisma.ride.count({ where: { status: RideStatus.cancelled } }),
      this.prisma.document.count({ where: { status: DocumentStatus.pending } }),
      this.prisma.vehicle.count({ where: { isVerified: false } }),
      this.prisma.report.count({ where: { status: ReportStatus.open } }),
      this.prisma.ridePassenger.aggregate({
        where: { status: RidePassengerStatus.completed },
        _sum: { fareAmount: true },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        riders: totalRiders,
        drivers: totalDrivers,
        admins: totalAdmins,
      },
      rides: {
        total: totalRides,
        scheduled: scheduledRides,
        ongoing: ongoingRides,
        completed: completedRides,
        cancelled: cancelledRides,
      },
      pendingApprovals: {
        documents: pendingDocuments,
        vehicles: pendingVehicles,
        reports: openReports,
      },
      financials: {
        totalCompletedFareVolume: revenueAggregate._sum.fareAmount || 0,
      },
    };
  }

  async getAllUsers(
    role?: UserRole,
    status?: UserStatus,
    search?: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: {
          profile: true,
          vehicles: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users: users.map((u) => {
        const { passwordHash, refreshTokenHash, ...userWithoutSecrets } = u;
        return userWithoutSecrets;
      }),
    };
  }

  async updateUserStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.id === adminId) {
      throw new BadRequestException('Admins cannot change their own account status');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status: dto.status },
      include: { profile: true },
    });

    const { passwordHash, refreshTokenHash, ...result } = updatedUser;

    return {
      message: `User status updated to ${dto.status}`,
      user: result,
    };
  }

  async getPendingDocuments() {
    return this.prisma.document.findMany({
      where: { status: DocumentStatus.pending },
      include: {
        uploader: {
          include: { profile: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async reviewDocument(adminId: string, docId: string, dto: ReviewDocumentDto) {
    const doc = await this.prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const updatedDoc = await this.prisma.document.update({
      where: { id: docId },
      data: {
        status: dto.status,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: { uploader: { include: { profile: true } } },
    });

    if (dto.status === DocumentStatus.approved) {
      const approvedDocs = await this.prisma.document.findMany({
        where: {
          userId: doc.userId,
          status: DocumentStatus.approved,
        },
      });

      const hasApprovedCnic = approvedDocs.some((d) => d.docType === 'cnic');
      const hasApprovedLicense = approvedDocs.some((d) => d.docType === 'driving_license');

      if (hasApprovedCnic && hasApprovedLicense) {
        await this.prisma.vehicle.updateMany({
          where: { driverId: doc.userId },
          data: { isVerified: true },
        });
      }
    }

    return {
      message: `Document status marked as ${dto.status}`,
      document: updatedDoc,
    };
  }


  async getPendingVehicles() {
    return this.prisma.vehicle.findMany({
      where: { isVerified: false },
      include: {
        driver: { include: { profile: true } },
        vehicleType: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async verifyVehicle(adminId: string, vehicleId: string, dto: VerifyVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isVerified: dto.isVerified },
      include: { driver: { include: { profile: true } }, vehicleType: true },
    });

    return {
      message: `Vehicle verification set to ${dto.isVerified}`,
      vehicle: updatedVehicle,
    };
  }

  async getVehicleTypes() {
    return this.prisma.vehicleType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createVehicleType(dto: CreateVehicleTypeDto) {
    const existing = await this.prisma.vehicleType.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Vehicle type '${dto.name}' already exists`);
    }

    const vehicleType = await this.prisma.vehicleType.create({
      data: {
        name: dto.name,
        maxCapacity: dto.maxCapacity,
        baseFare: dto.baseFare || 0,
        perKmRate: dto.perKmRate || 0,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    return {
      message: 'Vehicle type created successfully',
      vehicleType,
    };
  }

  async updateVehicleType(id: string, dto: UpdateVehicleTypeDto) {
    const type = await this.prisma.vehicleType.findUnique({
      where: { id },
    });

    if (!type) {
      throw new NotFoundException('Vehicle type not found');
    }

    const updatedType = await this.prisma.vehicleType.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.maxCapacity && { maxCapacity: dto.maxCapacity }),
        ...(dto.baseFare !== undefined && { baseFare: dto.baseFare }),
        ...(dto.perKmRate !== undefined && { perKmRate: dto.perKmRate }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return {
      message: 'Vehicle type updated successfully',
      vehicleType: updatedType,
    };
  }

  async getAllReports(status?: ReportStatus) {
    const where = status ? { status } : {};
    return this.prisma.report.findMany({
      where,
      include: {
        reporter: { include: { profile: true } },
        reportedUser: { include: { profile: true } },
        ride: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolveReport(adminId: string, reportId: string, dto: ResolveReportDto) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        resolvedAt: dto.status === ReportStatus.resolved ? new Date() : null,
      },
    });

    return {
      message: `Report status updated to ${dto.status}`,
      report: updatedReport,
    };
  }
}
