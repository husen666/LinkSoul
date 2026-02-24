import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsArray,
} from 'class-validator';

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

enum AttachmentType {
  SECURE = 'SECURE',
  ANXIOUS = 'ANXIOUS',
  AVOIDANT = 'AVOIDANT',
  FEARFUL = 'FEARFUL',
}

enum CommunicationStyle {
  DIRECT = 'DIRECT',
  INDIRECT = 'INDIRECT',
  ANALYTICAL = 'ANALYTICAL',
  EMOTIONAL = 'EMOTIONAL',
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ required: false, example: '1995-06-15' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  province?: string;
}

export class UpdatePsychProfileDto {
  @ApiProperty({ enum: AttachmentType, required: false })
  @IsOptional()
  @IsEnum(AttachmentType)
  attachmentType?: AttachmentType;

  @ApiProperty({ enum: CommunicationStyle, required: false })
  @IsOptional()
  @IsEnum(CommunicationStyle)
  communicationStyle?: CommunicationStyle;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personalityTags?: string[];
}
