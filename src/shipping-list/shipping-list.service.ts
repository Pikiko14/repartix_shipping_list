import { Queue } from 'bull';
import {
  CreateShippingListDto,
  OrderDto,
} from './dto/create-shipping-list.dto';
import { InjectQueue } from '@nestjs/bull';
import { RpcException } from '@nestjs/microservices';
import { CacheService } from 'src/commons/cache/cache.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DeleteShippingListDto } from './dto/delete-shipping-list.dto';
import { UpdateShippingListDto } from './dto/update-shipping-list.dto';
import { ShippingListRepository } from './repositories/shipping-list.repository';

@Injectable()
export class ShippingListService {
  constructor(
    @InjectQueue('shipping') private guidesQueue: Queue,
    @Inject() private readonly cacheService: CacheService,
    @Inject() private readonly repository: ShippingListRepository,
  ) {}

  async create(createShippingListDto: CreateShippingListDto) {
    // validamos si las ordenes que vienen ya alguna existe previamente en el modelo
    const orderIds = createShippingListDto.orders.map((o) => o.id);
    const isset = await this.repository.issetOrderId(orderIds);

    if (isset)
      throw new RpcException({
        message: `One or more orders isset in this shipping list: ${isset?.reference}`,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });

    // asignamos la fecha y referencia
    createShippingListDto.date = new Date();
    const reference = await this.repository.countModelByParentId(
      createShippingListDto.parent_id,
    );
    createShippingListDto.reference = (reference + 1)
      .toString()
      .padStart(8, '0');

    try {
      const shippingList = await this.repository.create(createShippingListDto);

      await this.cacheService.removeByPrefix(
        `keyv:${createShippingListDto.parent_id}:shipping-list:list`,
      );

      return {
        success: true,
        shippingList,
        message: 'Shipping list create success',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async findAll(queryParamsDto: QueryParamDto) {
    const cacheKey = `${queryParamsDto.parent_id}:shipping-list:list:${JSON.stringify(queryParamsDto)}`;
    let shippingList = await this.cacheService.getItem(cacheKey);
    if (shippingList) {
      return {
        success: true,
        shippingList,
        message: 'Shipping list (from cache)',
      };
    }

    try {
      const andConditions: any[] = [{ parent_id: queryParamsDto.parent_id }];

      // validamos la busqueda
      if (queryParamsDto.search) {
        const searchRegex = new RegExp(queryParamsDto.search as string, 'i');
        andConditions.push({
          $or: [
            { reference: searchRegex },
            { 'courier.full_name': searchRegex },
          ],
        });
      }

      // fechas
      if (queryParamsDto.from && queryParamsDto.to) {
        const to = new Date(queryParamsDto.to);
        const from = new Date(queryParamsDto.from);
        const startOfDay = new Date(from.setHours(0, 0, 0, 0));
        const endOfDay = new Date(to.setHours(23, 59, 59, 999));

        andConditions.push({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
      }

      // query final
      const query: Record<string, any> = { $and: andConditions };

      // paginación
      const page = Number(queryParamsDto.page) || 1;
      const perPage = Number(queryParamsDto.perPage) || 7;
      const skip = (page - 1) * perPage;

      shippingList = await this.repository.paginate(query, skip, perPage);

      // set in cache
      await this.cacheService.setItem(cacheKey, shippingList);

      return {
        success: true,
        shippingList,
        message: 'Shipping list',
      };
    } catch (error) {
      throw new RpcException(error.message);
    }
  }

  async findOne(findIdDto: DeleteShippingListDto) {
    const cacheKey = `${findIdDto.parent_id}:shipping-list:list:${JSON.stringify(findIdDto)}`;
    let shippingList = await this.cacheService.getItem(cacheKey);
    if (shippingList) {
      return {
        success: true,
        shippingList,
        message: 'Shipping list (from cache)',
      };
    }

    try {
      shippingList = await this.repository.find(
        findIdDto.id,
        findIdDto.parent_id,
      );

      if (!shippingList)
        throw new RpcException({
          error: true,
          status: HttpStatus.NOT_FOUND,
          message: 'Shipping list not found',
        });

      await this.cacheService.setItem(cacheKey, shippingList);

      return {
        succes: true,
        shippingList,
        message: 'Shipping list',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async update(id: string, updateShippingListDto: UpdateShippingListDto) {
    try {
      let shippingList = await this.repository.find(
        id,
        updateShippingListDto.parent_id,
      );

      if (!shippingList)
        throw new RpcException({
          error: true,
          status: HttpStatus.NOT_FOUND,
          message: 'Shipping list not found',
        });

      // validamos si las ordenes que vienen ya alguna existe previamente en el modelo
      const orderIds = updateShippingListDto.orders.map((o) => o.id);
      const isset = await this.repository.issetOrderIdNoShipping(id, orderIds);

      if (isset && isset.id !== id) {
        const references = updateShippingListDto.orders.map((o) => o.reference);

        throw new RpcException({
          message: `One or more orders of this (${references.join(
            ', ',
          )}) already exist) in this shipping list: ${isset?.reference}`,
          status: HttpStatus.BAD_REQUEST,
          error: true,
        });
      }

      shippingList = await this.repository.update(
        updateShippingListDto._id,
        updateShippingListDto,
      );

      await this.cacheService.removeByPrefix(
        `keyv:${updateShippingListDto.parent_id}:shipping-list:list`,
      );

      return {
        success: true,
        shippingList,
        message: 'Shipping list create success',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  }

  async remove(deleteShippingListDto: DeleteShippingListDto) {
    try {
      const shippingList = await this.repository.delete(
        deleteShippingListDto?.id,
        deleteShippingListDto?.parent_id,
      );

      if (!shippingList)
        throw new RpcException({
          message: 'Shipping list not found',
          status: HttpStatus.NOT_FOUND,
          error: true,
        });

      await this.cacheService.removeByPrefix(
        `keyv:${deleteShippingListDto.parent_id}:shipping-list:list`,
      );

      return {
        succes: true,
        shippingList,
        message: 'Shipping list delete success',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async updateOrderStatus(updateOrderStatus: any) {
    try {
      const shippingList = await this.repository.issetOrderId([
        updateOrderStatus.order_id,
      ]);

      const orders = shippingList.orders.map((el: OrderDto) => {
        if (el?.reference === updateOrderStatus?.reference)
          el.status = updateOrderStatus.status;
        return el;
      });

      await this.cacheService.removeByPrefix(
        `keyv:${updateOrderStatus.parent_id}:shipping-list:list`,
      );

      shippingList.orders = orders;

      await this.repository.update(shippingList.id, shippingList);

      return;
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }

  async printPdf(findIdDto: DeleteShippingListDto) {
    const shippingList = await this.repository.find(
      findIdDto.id,
      findIdDto.parent_id,
    );

    if (!shippingList)
      throw new RpcException({
        error: true,
        status: HttpStatus.NOT_FOUND,
        message: 'Shipping list not found',
      });

    try {
      await this.cacheService.removeByPrefix(
        `keyv:${findIdDto.parent_id}:shipping-list:list`,
      );

      // procesamos el pdf en la cola
      await this.guidesQueue.add('print', shippingList);

      return {
        success: true,
        pdf: 'In process',
        message: 'Shipping list pdf',
      };
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }
}
