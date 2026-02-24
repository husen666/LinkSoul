import { MatchStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMatchStatusDto {
  @IsEnum(MatchStatus, { message: 'status 必须是有效的匹配状态' })
  status!: MatchStatus;
}
