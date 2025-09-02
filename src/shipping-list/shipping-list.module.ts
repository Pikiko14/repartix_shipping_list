import { Module } from '@nestjs/common';
import {
  ShippingList,
  ShippingListSchema,
} from './schemas/shipping-list.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingListService } from './shipping-list.service';
import { ShippingListController } from './shipping-list.controller';
import { CacheServiceModule } from 'src/commons/cache/cache.module';
import { ShippingListRepository } from './repositories/shipping-list.repository';

@Module({
  imports: [
    CacheServiceModule,
    MongooseModule.forFeature([
      { name: ShippingList.name, schema: ShippingListSchema },
    ]),
  ],
  controllers: [ShippingListController],
  providers: [ShippingListService, ShippingListRepository],
})
export class ShippingListModule {}
