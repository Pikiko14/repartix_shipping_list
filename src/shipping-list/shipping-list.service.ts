import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { firstValueFrom } from 'rxjs';
import {
  CreateShippingListDto,
  OrderDto,
} from './dto/create-shipping-list.dto';
import { envs } from 'src/commons/configuration';
import { ClientProxy } from '@nestjs/microservices';
import { RpcException } from '@nestjs/microservices';
import { CacheService } from 'src/commons/cache/cache.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ShippingListEntity } from './entities/shipping-list.entity';
import { DeleteShippingListDto } from './dto/delete-shipping-list.dto';
import { UpdateShippingListDto } from './dto/update-shipping-list.dto';
import { CloudinaryService } from 'src/commons/cloudinary/cloudinary.service';
import { ShippingListRepository } from './repositories/shipping-list.repository';
import { ShippingListDocument } from 'src/shipping-list/schemas/shipping-list.schema';

@Injectable()
export class ShippingListService {
  constructor(
    @Inject() private readonly cacheService: CacheService,
    @Inject() private readonly cloudinary: CloudinaryService,
    @Inject() private readonly repository: ShippingListRepository,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
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
      let pdf = await this.generatePdf(shippingList);

      await this.cacheService.removeByPrefix(
        `keyv:${findIdDto.parent_id}:shipping-list:list`,
      );

      return {
        success: true,
        pdf,
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

  async generatePdf(shippingList: ShippingListDocument | ShippingListEntity) {
    try {
      const { configuration } = await firstValueFrom(
        this.client.send('find-configuration', shippingList.parent_id),
      );

      const fonts = {
        Roboto: {
          normal: path.join(process.cwd(), 'fonts', 'Roboto-Regular.ttf'),
          bold: path.join(process.cwd(), 'fonts', 'Roboto-Medium.ttf'),
          italics: path.join(process.cwd(), 'fonts', 'Roboto-Italic.ttf'),
          bolditalics: path.join(process.cwd(), 'fonts', 'Roboto-Italic.ttf'),
        },
      };
      const printer = new PdfPrinter(fonts);

      const currencyFormatter = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: configuration?.currency || 'COP',
        minimumFractionDigits: 2,
      });

      // Calcular totales
      const totalPedidos = shippingList.orders.length;
      const totalEnvio = shippingList.orders.reduce(
        (acc, o) => acc + (o.order_price ? parseFloat(o.order_price) : 0),
        0,
      );
      const totalRecaudo = shippingList.orders.reduce(
        (acc, o) => acc + (o.cash_amount ? parseFloat(o.cash_amount) : 0),
        0,
      );

      const docDefinition: any = {
        pageSize: 'LETTER',
        defaultStyle: { font: 'Roboto', fontSize: 10 },
        content: [
          {
            text: `Relación de envío N° ${shippingList.reference}`,
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20],
          },
          {
            columns: [
              {
                stack: [
                  { text: 'Domiciliario:', bold: true },
                  {
                    text: shippingList?.courier?.full_name?.toUpperCase() || '',
                  },
                ],
              },
              {
                stack: [
                  { text: 'Fecha:', bold: true, alignment: 'center' },
                  {
                    text: shippingList?.date?.toLocaleDateString() || '',
                    alignment: 'center',
                  },
                ],
              },
              {
                stack: [
                  {
                    text: 'Documento de identidad:',
                    bold: true,
                    alignment: 'right',
                  },
                  {
                    text: shippingList?.courier?.dni || '',
                    alignment: 'right',
                  },
                ],
              },
            ],
            style: 'infoBox',
            margin: [0, 0, 0, 20],
          },
          {
            table: {
              headerRows: 1,
              widths: ['auto', '*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Referencia', bold: true },
                  { text: 'Cliente', bold: true },
                  { text: 'Precio envío', bold: true, alignment: 'right' },
                  { text: 'Recaudo', bold: true, alignment: 'center' },
                  { text: 'Monto Recaudo', bold: true, alignment: 'right' },
                ],
                ...shippingList.orders.map((order) => [
                  order.reference || '',
                  `${order.client.name} ${order.client.last_name}`.trim(),
                  order.order_price
                    ? currencyFormatter.format(parseFloat(order.order_price))
                    : '',
                  {
                    text: order.cash_on_delivery ? 'Sí' : 'No',
                    alignment: 'center',
                  },
                  {
                    text: order.cash_amount
                      ? currencyFormatter.format(parseFloat(order.cash_amount.replace('.', '')))
                      : '',
                    alignment: 'right',
                  },
                ]),
                [
                  {
                    text: `Total pedidos: ${totalPedidos}`,
                    colSpan: 2,
                    bold: true,
                  },
                  {},
                  {
                    text: currencyFormatter.format(totalEnvio),
                    bold: true,
                    alignment: 'right',
                  },
                  { text: '', bold: true },
                  {
                    text: currencyFormatter.format(totalRecaudo),
                    bold: true,
                    alignment: 'right',
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: (i) => (i === 1 ? 1 : 0),
              vLineWidth: () => 0,
              hLineColor: () => 'grey',
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 4,
              paddingBottom: () => 4,
            },
            style: 'infoBox',
            margin: [0, 20, 0, 20],
          },
          {
            columns: [
              {
                text: 'FIRMA\n\nDirector de bodega',
                alignment: 'center',
                bold: true,
              },
              {
                text: 'FIRMA\n\nDomiciliario',
                alignment: 'center',
                bold: true,
              },
            ],
            margin: [0, 50, 0, 0],
          },
        ],
        styles: {
          header: { fontSize: 10, bold: true },
          infoBox: { fontSize: 10 },
        },
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const filePath = path.join(
        process.cwd(),
        `shipping-${shippingList.parent_id}-${shippingList.reference}.pdf`,
      );
      const writeStream = fs.createWriteStream(filePath);
      pdfDoc.pipe(writeStream);
      pdfDoc.end();

      // Esperamos a que el archivo se haya escrito completamente
      const pdf = await new Promise<string | null>((resolve, reject) => {
        writeStream.on('finish', async () => {
          try {
            // Borrar archivo viejo en Cloudinary si existe
            if (shippingList?.pdf_path) {
              await this.cloudinary.deleteFile(shippingList.pdf_path);
            }

            // Subir archivo nuevo
            const cloudinaryResult = await this.cloudinary.uploadFilePath(
              filePath,
              `shipping_list/${new Date().getMonth() + 1}-${new Date().getFullYear()}`,
              `shipping-list-${shippingList.parent_id}-${shippingList.reference}.pdf`,
            );

            if (cloudinaryResult?.secure_url) {
              shippingList.pdf_path = cloudinaryResult.secure_url;
              await this.repository.update(shippingList.id, shippingList);
              resolve(cloudinaryResult.secure_url);
            } else {
              resolve(null);
            }
          } catch (err) {
            reject(err);
          }
        });

        writeStream.on('error', reject);
      });

      setTimeout(() => fs.unlinkSync(filePath), 3000);

      return pdf;
    } catch (error) {
      throw new RpcException({
        message: error.message,
        status: HttpStatus.BAD_REQUEST,
        error: true,
      });
    }
  }
}
