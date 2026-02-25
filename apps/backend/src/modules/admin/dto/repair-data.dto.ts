import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const REPAIR_SCOPE = [
  'all',
  'avatars',
  'credits',
  'credit-create',
  'credit-levels',
] as const;

export class RepairDataDto {
  @IsOptional()
  @IsIn(REPAIR_SCOPE as unknown as string[], { message: 'scope 不支持' })
  scope?: 'all' | 'avatars' | 'credits' | 'credit-create' | 'credit-levels';

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;
}
