import { RpcException } from '@nestjs/microservices';
import { CacheService } from 'src/commons/cache/cache.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CreateShippingListDto } from './dto/create-shipping-list.dto';
import { UpdateShippingListDto } from './dto/update-shipping-list.dto';
import { ShippingListRepository } from './repositories/shipping-list.repository';
import { DeleteShippingListDto } from './dto/delete-shipping-list.dto';

@Injectable()
export class ShippingListService {
  constructor(
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
        status: HttpStatus.UNPROCESSABLE_ENTITY,
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
        succes: true,
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
      let shippingList = await this.repository.find(id, updateShippingListDto.parent_id);

      if (!shippingList)
        throw new RpcException({
          error: true,
          status: HttpStatus.NOT_FOUND,
          message: 'Shipping list not found',
        });

      shippingList = await this.repository.update(
        updateShippingListDto._id,
        updateShippingListDto,
      );

      await this.cacheService.removeByPrefix(
        `keyv:${updateShippingListDto.parent_id}:shipping-list:list`,
      );

      return {
        succes: true,
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
}
