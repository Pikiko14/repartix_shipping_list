import { ShippingListEntity } from 'src/shipping-list/entities/shipping-list.entity';
import { ShippingListDocument } from 'src/shipping-list/schemas/shipping-list.schema';
import { CreateShippingListDto } from 'src/shipping-list/dto/create-shipping-list.dto';
import { UpdateShippingListDto } from 'src/shipping-list/dto/update-shipping-list.dto';

export interface IShippingListDto {
  create(createShippingListDto: CreateShippingListDto): Promise<ShippingListEntity | unknown>;
  
  find(id: string, parentId: string): Promise<ShippingListEntity | null>;
  
  update(id: string, shipping: UpdateShippingListDto): Promise<ShippingListEntity | null>;
  
  delete(id: string, parent_id: string): Promise<ShippingListDocument | void>;
}
