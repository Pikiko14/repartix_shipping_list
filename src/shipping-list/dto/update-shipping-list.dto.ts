import { PartialType } from '@nestjs/mapped-types';
import { CreateShippingListDto } from './create-shipping-list.dto';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateShippingListDto extends PartialType(CreateShippingListDto) {
  @IsOptional()
  id?: string;

  @IsOptional()
  _id?: string;

  @IsOptional()
  @IsNumber()
  orders_delivered?: number;

  @IsOptional()
  @IsNumber()
  order_total?: number;
}
