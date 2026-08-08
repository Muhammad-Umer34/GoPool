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
import { CreateRideRequestDto } from './dto/create-ride-request.dto';
import { RespondRideRequestDto } from './dto/respond-ride-request.dto';
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

  @Get('my-bookings')
  async getMyBookings(@CurrentUser() user: JwtPayload) {
    return this.ridesService.getMyBookings(user.sub);
  }

  @Post(':id/request')
  @HttpCode(HttpStatus.CREATED)
  async createRideRequest(
    @CurrentUser() user: JwtPayload,
    @Param('id') rideId: string,
    @Body() dto: CreateRideRequestDto,
  ) {
    return this.ridesService.createRideRequest(user.sub, rideId, dto);
  }

  @Get(':id/requests')
  async getRideRequestsForDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') rideId: string,
  ) {
    return this.ridesService.getRideRequestsForDriver(user.sub, rideId);
  }

  @Patch('requests/:requestId/respond')
  async respondRideRequest(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
    @Body() dto: RespondRideRequestDto,
  ) {
    return this.ridesService.respondRideRequest(user.sub, requestId, dto);
  }

  @Patch('requests/:requestId/cancel')
  async cancelRideRequest(
    @CurrentUser() user: JwtPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.ridesService.cancelRideRequest(user.sub, requestId);
  }

  @Patch(':id/start')
  async startRide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.ridesService.startRide(user.sub, id);
  }

  @Patch('passengers/:passengerId/pickup')
  async pickupPassenger(
    @CurrentUser() user: JwtPayload,
    @Param('passengerId') passengerId: string,
    @Body('otpPin') otpPin?: string,
  ) {
    return this.ridesService.pickupPassenger(user.sub, passengerId, otpPin);
  }


  @Patch(':id/complete')
  async completeRide(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.ridesService.completeRide(user.sub, id);
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


