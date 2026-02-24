import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const OP_CATEGORIES = ['推荐', '发现', '活动', '公告', '系统'] as const;
const OP_STATUS = ['ACTIVE', 'INACTIVE'] as const;

export class UpdateOpMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(OP_CATEGORIES as unknown as string[], { message: 'category 不支持' })
  category?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'imageUrl 必须是有效 URL' })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'linkUrl 必须是有效 URL' })
  linkUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999)
  priority?: number;

  @IsOptional()
  @IsString()
  @IsIn(OP_STATUS as unknown as string[], { message: 'status 不支持' })
  status?: string;
}
