import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DEFAULT_MANAGED_AVATAR_COUNT,
  MAX_MANAGED_AVATAR_COUNT,
} from '../../../common/utils/avatar.util';

export class GenerateDefaultAvatarsDto {
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return DEFAULT_MANAGED_AVATAR_COUNT;
    return Number(value);
  })
  @IsInt({ message: 'count 必须是整数' })
  @Min(1, { message: 'count 不能小于 1' })
  @Max(MAX_MANAGED_AVATAR_COUNT, {
    message: `count 不能大于 ${MAX_MANAGED_AVATAR_COUNT}`,
  })
  count?: number;
}
