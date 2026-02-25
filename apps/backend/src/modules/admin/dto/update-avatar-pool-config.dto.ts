import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { AVATAR_POOL_MIN } from '../../../common/utils/avatar.util';

export class UpdateAvatarPoolConfigDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    return Number(value);
  })
  @IsInt({ message: 'perStyle 必须是整数' })
  @Min(AVATAR_POOL_MIN, { message: `perStyle 不能小于 ${AVATAR_POOL_MIN}` })
  perStyle?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean({ message: 'reset 必须是布尔值' })
  reset?: boolean;
}
