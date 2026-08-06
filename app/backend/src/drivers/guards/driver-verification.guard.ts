import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentStatus } from '@prisma/client';

@Injectable()
export class DriverVerificationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('User session not found');
    }

    // Admins can bypass driver restriction
    if (user.role === 'admin') {
      return true;
    }

    // Check if user has all required documents approved
    const cnicDoc = await this.prisma.document.findFirst({
      where: { userId: user.sub, docType: 'cnic' },
      orderBy: { submittedAt: 'desc' },
    });

    const licenseDoc = await this.prisma.document.findFirst({
      where: { userId: user.sub, docType: 'driving_license' },
      orderBy: { submittedAt: 'desc' },
    });

    const isApproved =
      cnicDoc?.status === DocumentStatus.approved &&
      licenseDoc?.status === DocumentStatus.approved;

    if (!isApproved) {
      throw new ForbiddenException({
        message: 'Driver verification is still pending or has been rejected.',
      });
    }

    return true;
  }
}
