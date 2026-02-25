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

  @ApiProperty({
    type: [Object],
    required: false,
    description: '灵魂相册媒体列表，支持图片与视频',
    example: [
      { url: 'https://example.com/a.jpg', type: 'image' },
      { url: 'https://example.com/b.mp4', type: 'video', mimeType: 'video/mp4' },
    ],
  })
  @IsOptional()
  @IsArray()
  soulGallery?: Array<string | { url: string; type?: 'image' | 'video'; mimeType?: string }>;
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
