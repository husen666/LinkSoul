import { Module } from '@nestjs/common';
import { FunController } from './fun.controller';
import { FunService } from './fun.service';

@Module({
  controllers: [FunController],
  providers: [FunService],
})
export class FunModule {}
