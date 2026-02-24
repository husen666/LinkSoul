import { Module } from '@nestjs/common';
import { SoulController, SoulAdminController } from './soul.controller';
import { SoulService } from './soul.service';

@Module({
  controllers: [SoulController, SoulAdminController],
  providers: [SoulService],
  exports: [SoulService],
})
export class SoulModule {}
