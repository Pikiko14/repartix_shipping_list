import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import {
  CreateShippingListDto,
  OrderDto,
} from './dto/create-shipping-list.dto';
import { RpcException } from '@nestjs/microservices';
import { CacheService } from 'src/commons/cache/cache.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ShippingListEntity } from './entities/shipping-list.entity';
import { DeleteShippingListDto } from './dto/delete-shipping-list.dto';
import { UpdateShippingListDto } from './dto/update-shipping-list.dto';
import { ShippingListRepository } from './repositories/shipping-list.repository';
import { ShippingListDocument } from 'src/shipping-list/schemas/shipping-list.schema';

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

      const pdf = await this.generatePdf(shippingList);

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

  async generatePdf(shippingList: ShippingListDocument | ShippingListEntity) {
    console.log(path.join(process.cwd(), 'fonts', 'Roboto-Regular.ttf'));
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'fonts', 'Roboto-Regular.ttf'),
        bold: path.join(__dirname, '..', '..', 'fonts', 'Roboto-Medium.ttf'),
        italics: path.join(process.cwd(), 'fonts', 'Roboto-Italic.ttf'),
        bolditalics: path.join(process.cwd(), 'fonts', 'Roboto-Italic.ttf'),
      },
    };
    const currentYear = new Date().getFullYear();
    const printer = new PdfPrinter(fonts);

    const docDefinition: any = {
      defaultStyle: {
        font: 'Roboto',
      },
      content: [
        {
          text: 'Relación de despacho N° 8',
          style: 'header',
          alignment: 'center',
          margin: [0, 0, 0, 20],
        },
        {
          columns: [
            { text: 'Domiciliario:\nejemplo' },
            { text: 'Fecha:\n01/09/2025', alignment: 'center' },
            { text: 'Documento de identidad:\n123456385', alignment: 'right' },
          ],
          style: 'infoBox',
          margin: [0, 0, 0, 20],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', '*', '*', 'auto'],
            body: [
              [
                { text: '# Domicilio', bold: false },
                { text: 'Cliente', bold: false },
                { text: 'Dirección', bold: false },
                { text: 'Teléfono', bold: false },
                { text: 'Productos', bold: false },
                { text: 'Total', bold: false },
              ],
              [
                '#1 JAE-000000091',
                'IVAN',
                'Atlántico / BARRANQUILLA / CALLE87#53-62',
                '3233341746',
                '',
                '(COP)12,000',
              ],
              [
                '#2 JAE-000000089',
                'uya',
                'Lara / Barquisimeto / new',
                '04242760155',
                'test',
                '(COP)12',
              ],
            ],
          },
        },
        {
          text: '\nCantidad de productos',
          style: 'subheader',
        },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Cantidad de pedidos:\n2', style: 'summary' },
                {
                  text: 'Total\n(COP)12,012',
                  style: 'summary',
                  alignment: 'right',
                },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 10, 0, 20],
        },
        {
          columns: [
            { text: 'FIRMA\n\nDirector de bodega', alignment: 'center' },
            { text: 'FIRMA\n\nejemplo\nDomiciliario', alignment: 'center' },
          ],
          margin: [0, 50, 0, 0],
        },
      ],
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const filePath = path.join(
      process.cwd(),
      `pdfs/shipping-list-${shippingList.parent_id}-${shippingList.reference}.pdf`,
    );
    pdfDoc.pipe(fs.createWriteStream(filePath));
    pdfDoc.end();
  }
}
