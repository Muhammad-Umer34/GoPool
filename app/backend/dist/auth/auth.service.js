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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const users_service_1 = require("../users/users.service");
let AuthService = class AuthService {
    constructor(usersService, jwtService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async validateUser(identifier, pass) {
        const user = await this.usersService.findByEmailOrPhone(identifier);
        if (user && user.passwordHash) {
            const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);
            if (isPasswordValid) {
                const { passwordHash, refreshTokenHash, ...result } = user;
                return result;
            }
        }
        return null;
    }
    async register(registerDto) {
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);
        const user = await this.usersService.create(registerDto, passwordHash);
        const tokens = await this.generateTokens(user.id, user.email, user.phoneNumber, user.role);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
        const { passwordHash: _, refreshTokenHash: __, ...userWithoutSecrets } = user;
        return {
            user: userWithoutSecrets,
            ...tokens,
        };
    }
    async login(user) {
        const tokens = await this.generateTokens(user.id, user.email, user.phoneNumber, user.role);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
        await this.usersService.updateLastLogin(user.id);
        return {
            user,
            ...tokens,
        };
    }
    async generateTokens(userId, email, phoneNumber, role) {
        const payload = {
            sub: userId,
            email,
            phoneNumber,
            role: role || 'rider',
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_ACCESS_SECRET ||
                    'gopool_super_secret_access_key_2026_change_in_prod',
                expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_REFRESH_SECRET ||
                    'gopool_super_secret_refresh_key_2026_change_in_prod',
                expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d'),
            }),
        ]);
        return {
            access_token: accessToken,
            refresh_token: refreshToken,
        };
    }
    async updateRefreshTokenHash(userId, refreshToken) {
        const hash = await bcrypt.hash(refreshToken, 10);
        await this.usersService.updateRefreshTokenHash(userId, hash);
    }
    async refreshTokens(userId, refreshToken) {
        const user = await this.usersService.findById(userId);
        if (!user || !user.refreshTokenHash) {
            throw new common_1.ForbiddenException('Access Denied: Invalid Refresh Token');
        }
        const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
        if (!refreshTokenMatches) {
            throw new common_1.ForbiddenException('Access Denied: Refresh Token Revoked or Mismatched');
        }
        const tokens = await this.generateTokens(user.id, user.email, user.phoneNumber, user.role);
        await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
        return tokens;
    }
    async logout(userId) {
        await this.usersService.updateRefreshTokenHash(userId, null);
        return { message: 'Logged out successfully' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map