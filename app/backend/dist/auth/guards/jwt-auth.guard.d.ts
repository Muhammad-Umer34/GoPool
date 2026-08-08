import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    private reflector;
    private redisService;
    constructor(reflector: Reflector, redisService: RedisService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export {};
