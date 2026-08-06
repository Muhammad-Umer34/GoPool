import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DriversService, DriverFiles } from './drivers.service';
import { DriverApplicationDto } from './dto/driver-application.dto';
import { RejectDriverDto } from './dto/reject-driver.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@Controller()
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  // --- Driver Endpoints ---

  @Post('driver/apply')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cnicFront', maxCount: 1 },
      { name: 'cnicBack', maxCount: 1 },
      { name: 'licenseFront', maxCount: 1 },
      { name: 'licenseBack', maxCount: 1 },
      { name: 'vehicleRegistrationCard', maxCount: 1 },
      { name: 'vehiclePhoto', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  async applyForDriver(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: DriverFiles,
    @Body() dto: DriverApplicationDto,
  ) {
    return this.driversService.applyForDriver(user.sub, files, dto);
  }

  @Get('driver/status')
  async getDriverStatus(@CurrentUser() user: JwtPayload) {
    return this.driversService.getDriverStatus(user.sub);
  }

  @Put('driver/application')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cnicFront', maxCount: 1 },
      { name: 'cnicBack', maxCount: 1 },
      { name: 'licenseFront', maxCount: 1 },
      { name: 'licenseBack', maxCount: 1 },
      { name: 'vehicleRegistrationCard', maxCount: 1 },
      { name: 'vehiclePhoto', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
  )
  async updateApplication(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: DriverFiles,
    @Body() dto: DriverApplicationDto,
  ) {
    return this.driversService.updateApplication(user.sub, files, dto);
  }

  // --- Admin Endpoints ---

  @Get('admin/drivers/pending')
  @Roles(UserRole.admin)
  async getPendingApplications() {
    return this.driversService.getPendingApplications();
  }

  @Get('admin/drivers/:id')
  @Roles(UserRole.admin)
  async getDriverById(@Param('id') id: string) {
    return this.driversService.getDriverById(id);
  }

  @Patch('admin/drivers/:id/approve')
  @Roles(UserRole.admin)
  async approveDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.driversService.approveDriver(user.sub, id);
  }

  @Patch('admin/drivers/:id/reject')
  @Roles(UserRole.admin)
  async rejectDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectDriverDto,
  ) {
    return this.driversService.rejectDriver(user.sub, id, dto);
  }
}
