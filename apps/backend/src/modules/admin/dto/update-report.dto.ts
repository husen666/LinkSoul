import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReportDto {
  @IsEnum(ReportStatus, { message: 'status 必须是有效的举报状态' })
  status!: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolution?: string;
}
