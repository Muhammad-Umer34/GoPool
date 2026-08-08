import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DriversModule } from '../drivers/drivers.module';

@Module({
  imports: [PrismaModule, DriversModule],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}
