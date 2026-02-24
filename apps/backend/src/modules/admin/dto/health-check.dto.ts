import { IsIn, IsString } from 'class-validator';

const SERVICE_KEYS = ['backend', 'admin', 'mobile', 'ai'] as const;

export class HealthCheckDto {
  @IsString()
  @IsIn(SERVICE_KEYS as unknown as string[], { message: 'serviceKey 不支持' })
  serviceKey!: string;
}
