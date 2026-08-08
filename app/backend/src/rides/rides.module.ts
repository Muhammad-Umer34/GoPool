import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DriversModule } from '../drivers/drivers.module';
import { TrackingModule } from '../tracking/tracking.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, DriversModule, TrackingModule, NotificationsModule],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}


