import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MatchesModule } from './modules/matches/matches.module';
import { ChatModule } from './modules/chat/chat.module';
import { AiModule } from './modules/ai/ai.module';
import { AdminModule } from './modules/admin/admin.module';
import { SoulModule } from './modules/soul/soul.module';
import { FeedModule } from './modules/feed/feed.module';
import { FunModule } from './modules/fun/fun.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const ttl = config.get<number>('THROTTLE_TTL_MS', 60_000);
        const limit = config.get<number>('THROTTLE_LIMIT', 100);
        return [{ ttl, limit }];
      },
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    MatchesModule,
    ChatModule,
    AiModule,
    AdminModule,
    SoulModule,
    FeedModule,
    FunModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
