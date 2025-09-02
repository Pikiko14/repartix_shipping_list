export class ShippingListEntity {
  id?: string;
  reference: string;
  date: Date;
  courier: {
    phone?: string;
    full_name: string;
    vehicle_type?: string;
    license_plate?: string;
    dni?: string;
  };
  orders: {
    id?: string;
    reference?: string;
    client: {
      name: string;
      last_name: string;
      address: string;
      phone?: string;
    };
    sender: {
      brand_name: string;
      brand_phone?: string;
    };
    status?: string;
    order_price?: string;
    cash_on_delivery?: boolean;
    cash_amount?: string;
  }[];
  parent_id?: string;
}
