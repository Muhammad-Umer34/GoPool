import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { DriversModule } from './drivers/drivers.module';
import { RidesModule } from './rides/rides.module';
import { RatingsModule } from './ratings/ratings.module';
import { TrackingModule } from './tracking/tracking.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './redis/redis.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    CloudinaryModule,
    DriversModule,
    RidesModule,
    RatingsModule,
    TrackingModule,
    ChatModule,
    NotificationsModule,
    AdminModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

