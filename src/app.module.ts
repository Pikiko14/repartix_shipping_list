import { envs } from './commons/configuration';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheServiceModule } from './commons/cache/cache.module';
import { ShippingListModule } from './shipping-list/shipping-list.module';
import { QueuesModule } from './commons/queues/queues.module';

@Module({
  imports: [
    QueuesModule,
    CacheServiceModule,
    ShippingListModule,
    MongooseModule.forRoot(envs.app_env === 'production' ?  envs.atlas_url : envs.db_url,),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
