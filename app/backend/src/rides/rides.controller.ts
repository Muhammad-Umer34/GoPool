import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { SearchRideDto } from './dto/search-ride.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { DriverVerificationGuard } from '../drivers/guards/driver-verification.guard';

@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  @UseGuards(DriverVerificationGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRide(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRideDto,
  ) {
    return this.ridesService.createRide(user.sub, dto);
  }

  @Get('search')
  @Public()
  async searchRides(@Query() dto: SearchRideDto) {
    return this.ridesService.searchRides(dto);
  }

  @Get('my-offers')
  async getMyOfferedRides(@CurrentUser() user: JwtPayload) {
    return this.ridesService.getMyOfferedRides(user.sub);
  }

  @Get(':id')
  @Public()
  async getRideById(@Param('id') id: string) {
    return this.ridesService.getRideById(id);
  }

  @Patch(':id/cancel')
  async cancelRide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.ridesService.cancelRide(user.sub, id);
  }
}
