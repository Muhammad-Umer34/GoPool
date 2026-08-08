import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@CurrentUser() user: any, @Body() _loginDto: LoginDto) {
    return this.authService.login(user);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshTokens(@CurrentUser() user: any) {
    const userId = user.id;
    const refreshToken = user.refreshToken;
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@CurrentUser('id') userId: string, @Req() req: any) {
    const authHeader = req.headers?.authorization;
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : undefined;
    return this.authService.logout(userId, token);
  }


  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    const { passwordHash, refreshTokenHash, ...userProfile } = user;
    return userProfile;
  }
}
