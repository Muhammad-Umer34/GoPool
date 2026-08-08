import { IsEnum, IsNotEmpty } from 'class-validator';
import { ReportStatus } from '@prisma/client';

export class ResolveReportDto {
  @IsNotEmpty({ message: 'Report status is required' })
  @IsEnum(ReportStatus, { message: 'Status must be open, investigating, resolved, or dismissed' })
  status: ReportStatus;
}
