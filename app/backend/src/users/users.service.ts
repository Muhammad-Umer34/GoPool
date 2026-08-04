import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto, passwordHash: string) {
    const { email, phoneNumber, firstName, lastName, role } = createUserDto;

    // Check if user already exists
    if (email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        throw new ConflictException('User with this email already exists');
      }
    }

    if (phoneNumber) {
      const existingPhone = await this.prisma.user.findUnique({ where: { phoneNumber } });
      if (existingPhone) {
        throw new ConflictException('User with this phone number already exists');
      }
    }

    // Atomic creation of user and profile using Prisma transaction
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email || null,
          phoneNumber: phoneNumber || null,
          passwordHash,
          role: (role as UserRole) || UserRole.rider,
          profile: {
            create: {
              firstName,
              lastName,
            },
          },
        },
        include: {
          profile: true,
        },
      });

      return user;
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmailOrPhone(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phoneNumber: identifier }],
      },
      include: { profile: true },
    });
  }

  async updateRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }
}
