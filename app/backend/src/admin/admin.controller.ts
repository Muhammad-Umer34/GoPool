import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { VerifyVehicleDto } from './dto/verify-vehicle.dto';
import { CreateVehicleTypeDto, UpdateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { UserStatus, ReportStatus } from '@prisma/client';

@Controller('admin')
@Roles(UserRole.admin)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  async getAllUsers(
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getAllUsers(
      role,
      status,
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch('users/:userId/status')
  async updateUserStatus(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(user.sub, userId, dto);
  }

  @Get('documents/pending')
  async getPendingDocuments() {
    return this.adminService.getPendingDocuments();
  }

  @Patch('documents/:docId/review')
  async reviewDocument(
    @CurrentUser() user: JwtPayload,
    @Param('docId') docId: string,
    @Body() dto: ReviewDocumentDto,
  ) {
    return this.adminService.reviewDocument(user.sub, docId, dto);
  }

  @Get('vehicles/pending')
  async getPendingVehicles() {
    return this.adminService.getPendingVehicles();
  }

  @Patch('vehicles/:vehicleId/verify')
  async verifyVehicle(
    @CurrentUser() user: JwtPayload,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: VerifyVehicleDto,
  ) {
    return this.adminService.verifyVehicle(user.sub, vehicleId, dto);
  }

  @Get('vehicle-types')
  async getVehicleTypes() {
    return this.adminService.getVehicleTypes();
  }

  @Post('vehicle-types')
  @HttpCode(HttpStatus.CREATED)
  async createVehicleType(@Body() dto: CreateVehicleTypeDto) {
    return this.adminService.createVehicleType(dto);
  }

  @Patch('vehicle-types/:id')
  async updateVehicleType(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleTypeDto,
  ) {
    return this.adminService.updateVehicleType(id, dto);
  }

  @Get('reports')
  async getAllReports(@Query('status') status?: ReportStatus) {
    return this.adminService.getAllReports(status);
  }

  @Patch('reports/:reportId/status')
  async resolveReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportId') reportId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.adminService.resolveReport(user.sub, reportId, dto);
  }
}
