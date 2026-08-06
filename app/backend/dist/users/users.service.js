"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const user_role_enum_1 = require("../common/enums/user-role.enum");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createUserDto, passwordHash) {
        const { email, phoneNumber, firstName, lastName, role } = createUserDto;
        const existingEmail = await this.prisma.user.findUnique({ where: { email } });
        if (existingEmail) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        if (phoneNumber) {
            const existingPhone = await this.prisma.user.findUnique({ where: { phoneNumber } });
            if (existingPhone) {
                throw new common_1.ConflictException('User with this phone number already exists');
            }
        }
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: email || null,
                    phoneNumber: phoneNumber || null,
                    passwordHash,
                    role: role || user_role_enum_1.UserRole.rider,
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
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { profile: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async findByEmailOrPhone(identifier) {
        return this.prisma.user.findFirst({
            where: {
                OR: [{ email: identifier }, { phoneNumber: identifier }],
            },
            include: { profile: true },
        });
    }
    async updateRefreshTokenHash(userId, refreshTokenHash) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash },
        });
    }
    async updateLastLogin(userId) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { lastLoginAt: new Date() },
        });
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map