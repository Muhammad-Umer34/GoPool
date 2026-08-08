import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}


  async validateUser(identifier: string, pass: string): Promise<any> {
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

  async register(registerDto: RegisterDto) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    const user = await this.usersService.create(registerDto, passwordHash);

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.phoneNumber,
      user.role,
    );
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    const { passwordHash: _, refreshTokenHash: __, ...userWithoutSecrets } = user;

    return {
      user: userWithoutSecrets,
      ...tokens,
    };
  }

  async login(user: any) {
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.phoneNumber,
      user.role,
    );
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    await this.usersService.updateLastLogin(user.id);

    return {
      user,
      ...tokens,
    };
  }

  async generateTokens(
    userId: string,
    email?: string | null,
    phoneNumber?: string | null,
    role?: string,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      email,
      phoneNumber,
      role: role || 'rider',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as object, {
        secret:
          process.env.JWT_ACCESS_SECRET ||
          'gopool_super_secret_access_key_2026_change_in_prod',
        expiresIn: (process.env.JWT_ACCESS_EXPIRY || '15m') as any,
      }),
      this.jwtService.signAsync(payload as object, {
        secret:
          process.env.JWT_REFRESH_SECRET ||
          'gopool_super_secret_refresh_key_2026_change_in_prod',
        expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async updateRefreshTokenHash(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshTokenHash(userId, hash);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshTokenHash) {
      throw new ForbiddenException('Access Denied: Invalid Refresh Token');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshTokenHash,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied: Refresh Token Revoked or Mismatched');
    }

    // Refresh Token Rotation: issue new access token & new refresh token
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.phoneNumber,
      user.role,
    );
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async logout(userId: string, accessToken?: string) {
    await this.usersService.updateRefreshTokenHash(userId, null);
    if (accessToken) {
      await this.redisService.blacklistToken(accessToken, 900);
    }
    return { message: 'Logged out successfully' };
  }
}

