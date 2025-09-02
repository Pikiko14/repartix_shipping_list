import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ShippingListEntity } from '../entities/shipping-list.entity';
import { CreateShippingListDto } from '../dto/create-shipping-list.dto';
import { IShippingListDto } from 'src/commons/interfaces/respository.interface';
import {
  ShippingList,
  ShippingListDocument,
} from '../schemas/shipping-list.schema';
import { PaginationResponseInterface } from 'src/commons/interfaces/response.interface';
import { UpdateShippingListDto } from '../dto/update-shipping-list.dto';

@Injectable()
export class ShippingListRepository implements IShippingListDto {
  constructor(
    @InjectModel(ShippingList.name) private readonly model: Model<ShippingList>,
  ) {}

  async create(
    createShippingListDto: CreateShippingListDto,
  ): Promise<ShippingListEntity | unknown> {
    try {
      return await this.model.create(createShippingListDto);
    } catch (error) {
      throw new Error('Error creating shipping list');
    }
  }

  async find(
    id: string,
    parent_id: string,
  ): Promise<ShippingListEntity | null> {
    try {
      return await this.model.findOne({ _id: id, parent_id });
    } catch (error) {
      throw new Error('Error creating shipping list');
    }
  }

  async update(
    id: string,
    shipping: UpdateShippingListDto,
  ): Promise<ShippingListEntity | null> {
    try {
      return await this.model.findOneAndUpdate({ _id: id }, shipping, {
        new: true,
      });
    } catch (error) {
      throw new Error('Error creating shipping list');
    }
  }

  async delete(
    id: string,
    parent_id: string,
  ): Promise<ShippingListDocument | void> {
    try {
      return await this.model.findOneAndDelete({ _id: id, parent_id });
    } catch (error) {
      throw new Error('Error creating shipping list');
    }
  }

  /**
   * Paginate shipping list
   * @param query - Query object for filtering results
   * @param skip - Number of documents to skip
   * @param perPage - Number of documents per page
   * @param sortBy - Field to sort by (default: "name")
   * @param order - Sort order (1 for ascending, -1 for descending, default: "1")
   */
  public async paginate(
    query: Record<string, any>,
    skip: number,
    perPage: number,
    fields: string[] = [
      '_id',
      'reference',
      'date',
      'cod_city',
      'courier.full_name',
      'orders.reference',
      'orders.status',
    ],
  ): Promise<PaginationResponseInterface> {
    try {
      // Fetch paginated data
      const users = await this.model
        .find(query)
        .select(fields.length > 0 ? fields.join(' ') : '')
        .skip(skip)
        .limit(perPage);

      // Get total count of matching documents
      const totalUsers = await this.model.countDocuments(query);

      // Calculate total pages
      const totalPages = Math.ceil(totalUsers / perPage);

      return {
        data: users,
        totalPages,
        totalItems: totalUsers,
      };
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  async countModelByParentId(parentId: string): Promise<number> {
    try {
      return await this.model.countDocuments({ parent_id: parentId });
    } catch (error) {
      throw new Error('Error counting shipping lists');
    }
  }

  async issetOrderId(ordersId: string[]): Promise<ShippingListDocument> {
    try {
      return await this.model.findOne({
        'orders.id': { $in: ordersId },
      });
    } catch (error) {
      throw new Error('Error checking if order exists');
    }
  }
}
