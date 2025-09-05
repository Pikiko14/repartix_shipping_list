import { Module } from '@nestjs/common';
import {
  ShippingList,
  ShippingListSchema,
} from './schemas/shipping-list.schema';
import { BullModule } from '@nestjs/bull';
import { MongooseModule } from '@nestjs/mongoose';
import { NatsModule } from 'src/transports/nats.module';
import { ShippingListService } from './shipping-list.service';
import { ShippingListController } from './shipping-list.controller';
import { CacheServiceModule } from 'src/commons/cache/cache.module';
import { PrintPdfProcessor } from './processors/print-pdf.processor';
import { CloudinaryModule } from 'src/commons/cloudinary/cloudinary.module';
import { ShippingListRepository } from './repositories/shipping-list.repository';

@Module({
  imports: [
    NatsModule,
    CloudinaryModule,
    CacheServiceModule,
    BullModule.registerQueue({
      name: 'shipping',
    }),
    MongooseModule.forFeature([
      { name: ShippingList.name, schema: ShippingListSchema },
    ]),
  ],
  controllers: [ShippingListController],
  providers: [ShippingListService, ShippingListRepository, PrintPdfProcessor],
})
export class ShippingListModule {}
