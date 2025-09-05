// commons/commons.module.ts
import { envs } from '../configuration';
import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: envs.redis_host,
        port: envs.redis_port,
      },
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
