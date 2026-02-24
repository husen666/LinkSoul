import { UserStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, { message: 'status 必须是有效的用户状态' })
  status!: UserStatus;
}
