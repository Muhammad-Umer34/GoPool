import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { DriverApplicationDto, AllowedVehicleCategory } from './dto/driver-application.dto';
import { RejectDriverDto } from './dto/reject-driver.dto';
import { DocumentStatus, DocumentType, UserRole } from '@prisma/client';

export interface DriverFiles {
  cnicFront?: Express.Multer.File[];
  cnicBack?: Express.Multer.File[];
  licenseFront?: Express.Multer.File[];
  licenseBack?: Express.Multer.File[];
  vehicleRegistrationCard?: Express.Multer.File[];
  vehiclePhoto?: Express.Multer.File[];
  selfie?: Express.Multer.File[];
}

@Injectable()
export class DriversService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async onModuleInit() {
    // Seed standard vehicle types if empty
    const count = await this.prisma.vehicleType.count();
    if (count === 0) {
      await this.prisma.vehicleType.createMany({
        data: [
          {
            name: 'Motorbike',
            maxCapacity: 1, // 1 passenger + 1 driver = 2 max
            baseFare: 50.0,
            perKmRate: 15.0,
          },
          {
            name: 'Car',
            maxCapacity: 6, // 6 passengers + 1 driver = 7 max
            baseFare: 150.0,
            perKmRate: 35.0,
          },
        ],
      });
    }
  }

  async applyForDriver(userId: string, files: DriverFiles, dto: DriverApplicationDto) {
    // 1. Validate Seat Capacity by Vehicle Category
    if (dto.vehicleCategory === AllowedVehicleCategory.MOTORBIKE) {
      if (dto.seatCapacity > 1) {
        throw new BadRequestException(
          'Motorbike capacity limit exceeded. A motorbike allows a maximum of 1 passenger seat (2 total people on bike).',
        );
      }
    } else if (dto.vehicleCategory === AllowedVehicleCategory.CAR) {
      if (dto.seatCapacity > 6) {
        throw new BadRequestException(
          'Car capacity limit exceeded. A car allows a maximum of 6 passenger seats (7 total people in car).',
        );
      }
    }

    // 2. Validate License Expiry Date
    const expiryDate = new Date(dto.licenseExpiryDate);
    if (isNaN(expiryDate.getTime())) {
      throw new BadRequestException('Invalid license expiry date format');
    }
    if (expiryDate < new Date()) {
      throw new BadRequestException('Driving license has already expired');
    }

    // 3. Validate uploaded required files
    const cnicFront = files.cnicFront?.[0];
    const cnicBack = files.cnicBack?.[0];
    const licenseFront = files.licenseFront?.[0];
    const licenseBack = files.licenseBack?.[0];
    const vehicleRegCard = files.vehicleRegistrationCard?.[0];
    const vehiclePhoto = files.vehiclePhoto?.[0];
    const selfie = files.selfie?.[0];

    if (!cnicFront || !cnicBack) {
      throw new BadRequestException('Both CNIC Front and CNIC Back images are required');
    }
    if (!licenseFront || !licenseBack) {
      throw new BadRequestException('Both Driving License Front and License Back images are required');
    }
    if (!vehicleRegCard) {
      throw new BadRequestException('Vehicle registration card image is required');
    }

    // 4. Check for duplicate application status
    const existingCnic = await this.prisma.document.findFirst({
      where: { userId, docType: DocumentType.cnic },
      orderBy: { submittedAt: 'desc' },
    });

    const existingLicense = await this.prisma.document.findFirst({
      where: { userId, docType: DocumentType.driving_license },
      orderBy: { submittedAt: 'desc' },
    });

    if (
      existingCnic?.status === DocumentStatus.approved &&
      existingLicense?.status === DocumentStatus.approved
    ) {
      throw new ConflictException('Driver application is already approved');
    }

    if (
      existingCnic?.status === DocumentStatus.pending &&
      existingLicense?.status === DocumentStatus.pending
    ) {
      throw new ConflictException('You already have a pending driver application under review');
    }

    // Check duplicate vehicle plate number
    const existingPlate = await this.prisma.vehicle.findUnique({
      where: { plateNumber: dto.plateNumber.toUpperCase().trim() },
    });

    if (existingPlate && existingPlate.driverId !== userId) {
      throw new ConflictException(
        `Vehicle with plate number ${dto.plateNumber} is already registered by another user.`,
      );
    }

    // 5. Cloudinary Uploads
    const cnicFolder = `ride-pooling/drivers/${userId}/cnic`;
    const licenseFolder = `ride-pooling/drivers/${userId}/license`;
    const vehicleFolder = `ride-pooling/drivers/${userId}/vehicle`;

    const cnicFrontRes = await this.cloudinaryService.uploadImage(cnicFront, cnicFolder, 'front');
    const cnicBackRes = await this.cloudinaryService.uploadImage(cnicBack, cnicFolder, 'back');
    const licenseFrontRes = await this.cloudinaryService.uploadImage(licenseFront, licenseFolder, 'front');
    const licenseBackRes = await this.cloudinaryService.uploadImage(licenseBack, licenseFolder, 'back');
    const vehicleRegRes = await this.cloudinaryService.uploadImage(vehicleRegCard, vehicleFolder, 'registration');

    let vehiclePhotoRes = null;
    if (vehiclePhoto) {
      vehiclePhotoRes = await this.cloudinaryService.uploadImage(vehiclePhoto, vehicleFolder, 'photo');
    }

    let selfieRes = null;
    if (selfie) {
      selfieRes = await this.cloudinaryService.uploadImage(
        selfie,
        `ride-pooling/drivers/${userId}/profile`,
        'selfie',
      );
    }

    // 6. Find or get Vehicle Type ID from database
    const vehicleTypeName = dto.vehicleCategory === AllowedVehicleCategory.MOTORBIKE ? 'Motorbike' : 'Car';
    let vehicleType = await this.prisma.vehicleType.findUnique({
      where: { name: vehicleTypeName },
    });

    if (!vehicleType) {
      vehicleType = await this.prisma.vehicleType.create({
        data: {
          name: vehicleTypeName,
          maxCapacity: dto.vehicleCategory === AllowedVehicleCategory.MOTORBIKE ? 1 : 6,
          baseFare: dto.vehicleCategory === AllowedVehicleCategory.MOTORBIKE ? 50.0 : 150.0,
          perKmRate: dto.vehicleCategory === AllowedVehicleCategory.MOTORBIKE ? 15.0 : 35.0,
        },
      });
    }

    // 7. Atomic DB updates (CNIC doc, License doc, Vehicle Registration doc, & Vehicle creation)
    const [cnicDoc, licenseDoc, vehicleRegDoc, vehicle] = await this.prisma.$transaction(async (tx) => {
      const cDoc = await tx.document.create({
        data: {
          userId,
          docType: DocumentType.cnic,
          documentUrl: JSON.stringify({
            front: cnicFrontRes,
            back: cnicBackRes,
            cnicNumber: dto.cnicNumber,
            cnicName: dto.cnicName,
            selfie: selfieRes,
          }),
          status: DocumentStatus.pending,
        },
      });

      const lDoc = await tx.document.create({
        data: {
          userId,
          docType: DocumentType.driving_license,
          documentUrl: JSON.stringify({
            front: licenseFrontRes,
            back: licenseBackRes,
            licenseNumber: dto.licenseNumber,
            licenseExpiryDate: expiryDate.toISOString(),
          }),
          status: DocumentStatus.pending,
        },
      });

      const vDoc = await tx.document.create({
        data: {
          userId,
          docType: DocumentType.vehicle_registration,
          documentUrl: JSON.stringify({
            registrationCard: vehicleRegRes,
            vehiclePhoto: vehiclePhotoRes,
            category: dto.vehicleCategory,
            make: dto.vehicleMake,
            model: dto.vehicleModel,
            year: dto.vehicleYear,
            color: dto.vehicleColor,
            plateNumber: dto.plateNumber.toUpperCase().trim(),
            seatCapacity: dto.seatCapacity,
          }),
          status: DocumentStatus.pending,
        },
      });

      // Upsert driver vehicle
      const veh = await tx.vehicle.upsert({
        where: { plateNumber: dto.plateNumber.toUpperCase().trim() },
        create: {
          driverId: userId,
          vehicleTypeId: vehicleType.id,
          make: dto.vehicleMake,
          model: dto.vehicleModel,
          year: dto.vehicleYear,
          color: dto.vehicleColor,
          plateNumber: dto.plateNumber.toUpperCase().trim(),
          seatCapacity: dto.seatCapacity,
          isVerified: false,
          isActive: true,
        },
        update: {
          driverId: userId,
          vehicleTypeId: vehicleType.id,
          make: dto.vehicleMake,
          model: dto.vehicleModel,
          year: dto.vehicleYear,
          color: dto.vehicleColor,
          seatCapacity: dto.seatCapacity,
          isVerified: false,
          isActive: true,
        },
      });

      return [cDoc, lDoc, vDoc, veh];
    });

    return {
      message: 'Driver and Vehicle application submitted successfully and is currently under review by admin.',
      status: DocumentStatus.pending,
      submittedAt: cnicDoc.submittedAt,
      applicationSummary: {
        driverId: userId,
        cnicNumber: dto.cnicNumber,
        licenseNumber: dto.licenseNumber,
        vehicle: {
          id: vehicle.id,
          category: dto.vehicleCategory,
          make: dto.vehicleMake,
          model: dto.vehicleModel,
          year: dto.vehicleYear,
          color: dto.vehicleColor,
          plateNumber: vehicle.plateNumber,
          passengerSeatCapacity: vehicle.seatCapacity,
        },
      },
    };
  }

  async getDriverStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, vehicles: { include: { vehicleType: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const cnicDoc = await this.prisma.document.findFirst({
      where: { userId, docType: DocumentType.cnic },
      orderBy: { submittedAt: 'desc' },
    });

    const licenseDoc = await this.prisma.document.findFirst({
      where: { userId, docType: DocumentType.driving_license },
      orderBy: { submittedAt: 'desc' },
    });

    const vehicleDoc = await this.prisma.document.findFirst({
      where: { userId, docType: DocumentType.vehicle_registration },
      orderBy: { submittedAt: 'desc' },
    });

    if (!cnicDoc || !licenseDoc) {
      return {
        verificationStatus: 'NOT_APPLIED',
        user: {
          id: user.id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        },
      };
    }

    let overallStatus: string = DocumentStatus.pending;
    if (
      cnicDoc.status === DocumentStatus.approved &&
      licenseDoc.status === DocumentStatus.approved &&
      vehicleDoc?.status === DocumentStatus.approved
    ) {
      overallStatus = DocumentStatus.approved;
    } else if (
      cnicDoc.status === DocumentStatus.rejected ||
      licenseDoc.status === DocumentStatus.rejected ||
      vehicleDoc?.status === DocumentStatus.rejected
    ) {
      overallStatus = DocumentStatus.rejected;
    }

    let cnicMeta: any = {};
    let licenseMeta: any = {};
    let vehicleMeta: any = {};

    try {
      cnicMeta = JSON.parse(cnicDoc.documentUrl);
    } catch {}

    try {
      licenseMeta = JSON.parse(licenseDoc.documentUrl);
    } catch {}

    if (vehicleDoc) {
      try {
        vehicleMeta = JSON.parse(vehicleDoc.documentUrl);
      } catch {}
    }

    return {
      verificationStatus: overallStatus,
      submittedAt: cnicDoc.submittedAt,
      reviewedAt: cnicDoc.reviewedAt || licenseDoc.reviewedAt,
      reviewedBy: cnicDoc.reviewedBy || licenseDoc.reviewedBy,
      cnicDetails: {
        cnicNumber: cnicMeta.cnicNumber,
        cnicName: cnicMeta.cnicName,
        urls: { front: cnicMeta.front, back: cnicMeta.back, selfie: cnicMeta.selfie },
      },
      licenseDetails: {
        licenseNumber: licenseMeta.licenseNumber,
        licenseExpiryDate: licenseMeta.licenseExpiryDate,
        urls: { front: licenseMeta.front, back: licenseMeta.back },
      },
      vehicleDetails: {
        make: vehicleMeta.make,
        model: vehicleMeta.model,
        year: vehicleMeta.year,
        color: vehicleMeta.color,
        plateNumber: vehicleMeta.plateNumber,
        passengerSeatCapacity: vehicleMeta.seatCapacity,
        urls: {
          registrationCard: vehicleMeta.registrationCard,
          vehiclePhoto: vehicleMeta.vehiclePhoto,
        },
      },
      rejectionReason:
        cnicMeta.rejectionReason || licenseMeta.rejectionReason || vehicleMeta.rejectionReason || null,
    };
  }

  async updateApplication(userId: string, files: DriverFiles, dto: DriverApplicationDto) {
    const status = await this.getDriverStatus(userId);
    if (status.verificationStatus === DocumentStatus.approved) {
      throw new BadRequestException('Driver application is already approved and cannot be modified.');
    }

    return this.applyForDriver(userId, files, dto);
  }

  // --- Admin Unified Review Methods ---

  async getPendingApplications() {
    const pendingCnicDocs = await this.prisma.document.findMany({
      where: { docType: DocumentType.cnic, status: DocumentStatus.pending },
      include: {
        uploader: {
          include: {
            profile: true,
            vehicles: { include: { vehicleType: true } },
          },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });

    const pendingApplications = await Promise.all(
      pendingCnicDocs.map(async (cnicDoc) => {
        const userId = cnicDoc.userId;

        const licenseDoc = await this.prisma.document.findFirst({
          where: { userId, docType: DocumentType.driving_license, status: DocumentStatus.pending },
          orderBy: { submittedAt: 'desc' },
        });

        const vehicleDoc = await this.prisma.document.findFirst({
          where: { userId, docType: DocumentType.vehicle_registration, status: DocumentStatus.pending },
          orderBy: { submittedAt: 'desc' },
        });

        let cnicMeta: any = {};
        let licenseMeta: any = {};
        let vehicleMeta: any = {};

        try {
          cnicMeta = JSON.parse(cnicDoc.documentUrl);
        } catch {}

        if (licenseDoc) {
          try {
            licenseMeta = JSON.parse(licenseDoc.documentUrl);
          } catch {}
        }

        if (vehicleDoc) {
          try {
            vehicleMeta = JSON.parse(vehicleDoc.documentUrl);
          } catch {}
        }

        const vehicleRecord = cnicDoc.uploader.vehicles[0];

        return {
          applicationId: cnicDoc.id,
          userId: cnicDoc.userId,
          userInformation: {
            id: cnicDoc.uploader.id,
            email: cnicDoc.uploader.email,
            phoneNumber: cnicDoc.uploader.phoneNumber,
            role: cnicDoc.uploader.role,
            status: cnicDoc.uploader.status,
          },
          profileInformation: cnicDoc.uploader.profile,
          cnicInformation: {
            cnicNumber: cnicMeta.cnicNumber,
            nameOnCnic: cnicMeta.cnicName,
            front: cnicMeta.front,
            back: cnicMeta.back,
            selfie: cnicMeta.selfie,
          },
          licenseInformation: {
            licenseNumber: licenseMeta.licenseNumber,
            expiryDate: licenseMeta.licenseExpiryDate,
            front: licenseMeta.front,
            back: licenseMeta.back,
          },
          vehicleInformation: {
            vehicleId: vehicleRecord?.id,
            category: vehicleMeta.category || vehicleRecord?.vehicleType?.name,
            make: vehicleMeta.make || vehicleRecord?.make,
            model: vehicleMeta.model || vehicleRecord?.model,
            year: vehicleMeta.year || vehicleRecord?.year,
            color: vehicleMeta.color || vehicleRecord?.color,
            plateNumber: vehicleMeta.plateNumber || vehicleRecord?.plateNumber,
            passengerSeatCapacity: vehicleMeta.seatCapacity || vehicleRecord?.seatCapacity,
            registrationCardUrl: vehicleMeta.registrationCard,
            vehiclePhotoUrl: vehicleMeta.vehiclePhoto,
          },
          verificationStatus: DocumentStatus.pending,
          submittedAt: cnicDoc.submittedAt,
        };
      }),
    );

    return pendingApplications;
  }

  async getDriverById(driverId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: driverId },
      include: { profile: true, vehicles: { include: { vehicleType: true } } },
    });

    if (!user) {
      throw new NotFoundException('Driver / User not found');
    }

    const applicationStatus = await this.getDriverStatus(driverId);
    return {
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
      profile: user.profile,
      registeredVehicles: user.vehicles,
      applicationDetails: applicationStatus,
    };
  }

  async approveDriver(adminId: string, driverId: string) {
    const cnicDoc = await this.prisma.document.findFirst({
      where: { userId: driverId, docType: DocumentType.cnic },
      orderBy: { submittedAt: 'desc' },
    });

    const licenseDoc = await this.prisma.document.findFirst({
      where: { userId: driverId, docType: DocumentType.driving_license },
      orderBy: { submittedAt: 'desc' },
    });

    const vehicleDoc = await this.prisma.document.findFirst({
      where: { userId: driverId, docType: DocumentType.vehicle_registration },
      orderBy: { submittedAt: 'desc' },
    });

    if (!cnicDoc || !licenseDoc) {
      throw new NotFoundException('Driver application documents not found');
    }

    const now = new Date();

    // Approve all documents, verify vehicle, and promote user role to 'both'
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: cnicDoc.id },
        data: { status: DocumentStatus.approved, reviewedBy: adminId, reviewedAt: now },
      });

      await tx.document.update({
        where: { id: licenseDoc.id },
        data: { status: DocumentStatus.approved, reviewedBy: adminId, reviewedAt: now },
      });

      if (vehicleDoc) {
        await tx.document.update({
          where: { id: vehicleDoc.id },
          data: { status: DocumentStatus.approved, reviewedBy: adminId, reviewedAt: now },
        });
      }

      // Update vehicle verification flag
      await tx.vehicle.updateMany({
        where: { driverId },
        data: { isVerified: true },
      });

      // Update user role to 'both'
      await tx.user.update({
        where: { id: driverId },
        data: { role: UserRole.both },
      });
    });

    return {
      message: 'Driver and Vehicle application approved successfully.',
      driverId,
      verificationStatus: DocumentStatus.approved,
      verifiedBy: adminId,
      verifiedAt: now,
    };
  }

  async rejectDriver(adminId: string, driverId: string, dto: RejectDriverDto) {
    const cnicDoc = await this.prisma.document.findFirst({
      where: { userId: driverId, docType: DocumentType.cnic },
      orderBy: { submittedAt: 'desc' },
    });

    const licenseDoc = await this.prisma.document.findFirst({
      where: { userId: driverId, docType: DocumentType.driving_license },
      orderBy: { submittedAt: 'desc' },
    });

    const vehicleDoc = await this.prisma.document.findFirst({
      where: { userId: driverId, docType: DocumentType.vehicle_registration },
      orderBy: { submittedAt: 'desc' },
    });

    if (!cnicDoc || !licenseDoc) {
      throw new NotFoundException('Driver application documents not found');
    }

    const now = new Date();

    let cnicMeta: any = {};
    let licenseMeta: any = {};
    let vehicleMeta: any = {};

    try {
      cnicMeta = JSON.parse(cnicDoc.documentUrl);
    } catch {}
    try {
      licenseMeta = JSON.parse(licenseDoc.documentUrl);
    } catch {}
    if (vehicleDoc) {
      try {
        vehicleMeta = JSON.parse(vehicleDoc.documentUrl);
      } catch {}
    }

    cnicMeta.rejectionReason = dto.reason;
    licenseMeta.rejectionReason = dto.reason;
    vehicleMeta.rejectionReason = dto.reason;

    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: cnicDoc.id },
        data: {
          status: DocumentStatus.rejected,
          reviewedBy: adminId,
          reviewedAt: now,
          documentUrl: JSON.stringify(cnicMeta),
        },
      });

      await tx.document.update({
        where: { id: licenseDoc.id },
        data: {
          status: DocumentStatus.rejected,
          reviewedBy: adminId,
          reviewedAt: now,
          documentUrl: JSON.stringify(licenseMeta),
        },
      });

      if (vehicleDoc) {
        await tx.document.update({
          where: { id: vehicleDoc.id },
          data: {
            status: DocumentStatus.rejected,
            reviewedBy: adminId,
            reviewedAt: now,
            documentUrl: JSON.stringify(vehicleMeta),
          },
        });
      }

      await tx.vehicle.updateMany({
        where: { driverId },
        data: { isVerified: false },
      });
    });

    return {
      message: 'Driver application rejected.',
      driverId,
      verificationStatus: DocumentStatus.rejected,
      rejectionReason: dto.reason,
      verifiedBy: adminId,
      verifiedAt: now,
    };
  }
}
