// shipping-list.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShippingListDocument = ShippingList & Document;

@Schema({ _id: false })
class Courier {
  @Prop()
  phone?: string;

  @Prop({ required: true, index: true })
  full_name: string;

  @Prop()
  vehicle_type?: string;

  @Prop()
  license_plate?: string;

  @Prop()
  dni?: string;
}

@Schema({ _id: false })
class Client {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  last_name: string;

  @Prop({ required: true })
  address: string;

  @Prop()
  phone?: string;
}

@Schema({ _id: false })
class Sender {
  @Prop({ required: true, index: true })
  brand_name: string;

  @Prop()
  brand_phone?: string;
}

@Schema({ _id: false })
class Order {
  @Prop()
  id?: string;

  @Prop()
  reference?: string;

  @Prop({ type: Client, required: true })
  client: Client;

  @Prop({ type: Sender, required: true })
  sender: Sender;

  @Prop()
  status?: string;

  @Prop()
  order_price?: string;

  @Prop()
  cash_on_delivery?: boolean;

  @Prop()
  cash_amount?: string;
}

@Schema({
  collection: 'shipping_lists',
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
})
export class ShippingList {
  @Prop({ index: true })
  reference: string;

  @Prop({ type: Date, required: true })
  date: Date;

  @Prop({ type: Courier, required: true })
  courier: Courier;

  @Prop({ type: [Order], default: [] })
  orders: Order[];

  @Prop({ required: true })
  parent_id?: string;

  @Prop({ required: false, default: false })
  is_close?: boolean;

  orders_delivered: number;
  order_total: number;
}

const ShippingListSchema = SchemaFactory.createForClass(ShippingList);

ShippingListSchema.virtual('orders_delivered').get(function (
  this: ShippingListDocument,
) {
  return this.orders.filter((el) => el.status === 'delivered').length;
});

ShippingListSchema.virtual('order_total').get(function (
  this: ShippingListDocument,
) {
  return this.orders.length;
});

export { ShippingListSchema };
