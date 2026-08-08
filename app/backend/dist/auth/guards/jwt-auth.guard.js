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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const passport_1 = require("@nestjs/passport");
const roles_constants_1 = require("../../common/constants/roles.constants");
const redis_service_1 = require("../../redis/redis.service");
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    constructor(reflector, redisService) {
        super();
        this.reflector = reflector;
        this.redisService = redisService;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(roles_constants_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers?.authorization;
        if (authHeader) {
            const token = authHeader.replace(/^Bearer\s+/i, '').trim();
            const isBlacklisted = await this.redisService.isTokenBlacklisted(token);
            if (isBlacklisted) {
                throw new common_1.UnauthorizedException('Token has been revoked upon logout');
            }
        }
        return super.canActivate(context);
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        redis_service_1.RedisService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map