import { PartialType } from '@nestjs/mapped-types';
import { CreateShippingListDto } from './create-shipping-list.dto';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

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

  @IsOptional()
  @IsBoolean()
  is_close?: boolean;
}
