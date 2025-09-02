// create-shipping-list.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDate,
  ValidateNested,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class CourierDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsOptional()
  @IsString()
  vehicle_type?: string;

  @IsOptional()
  @IsString()
  license_plate?: string;

  @IsOptional()
  @IsString()
  dni?: string;
}

class ClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  last_name: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

class SenderDto {
  @IsString()
  @IsNotEmpty()
  brand_name: string;

  @IsOptional()
  @IsString()
  brand_phone?: string;
}

class OrderDto {
  @IsNotEmpty()
  @IsString()
  id?: string;

  @IsNotEmpty()
  @IsString()
  reference?: string;

  @ValidateNested()
  @Type(() => ClientDto)
  @IsNotEmpty()
  client: ClientDto;

  @ValidateNested()
  @Type(() => SenderDto)
  @IsNotEmpty()
  sender: SenderDto;

  @IsNotEmpty()
  @IsString()
  status?: string;

  @IsNotEmpty()
  @IsString()
  order_price?: string;

  @IsNotEmpty()
  @IsBoolean()
  cash_on_delivery?: boolean;

  @IsOptional()
  @IsString()
  cash_amount?: string;
}

export class CreateShippingListDto {
  @IsString()
  @IsOptional()
  reference: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  date: Date;

  @ValidateNested()
  @Type(() => CourierDto)
  courier: CourierDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderDto)
  orders: OrderDto[];

  @IsOptional()
  parent_id?: string;
}
