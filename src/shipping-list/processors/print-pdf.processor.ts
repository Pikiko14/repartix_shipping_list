// emails/emails.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import * as fs from 'fs';
import { Job } from 'bull';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { firstValueFrom } from 'rxjs';
import { Inject, Logger } from '@nestjs/common';
import { envs } from 'src/commons/configuration';
import { ClientProxy } from '@nestjs/microservices';
import { ShippingListEntity } from '../entities/shipping-list.entity';
import { CloudinaryService } from 'src/commons/cloudinary/cloudinary.service';
import { ShippingListRepository } from '../repositories/shipping-list.repository';
import { ShippingListDocument } from 'src/shipping-list/schemas/shipping-list.schema';

@Processor('shipping')
export class PrintPdfProcessor {
  logger = new Logger(PrintPdfProcessor.name);
  constructor(
    @Inject() private readonly cloudinary: CloudinaryService,
    @Inject() private readonly repository: ShippingListRepository,
    @Inject(envs.nats_service_name) private readonly client: ClientProxy,
  ) {}

  @Process('print')
  async handlerPrint(job: Job<{ data: any }>) {
    try {
      await this.generatePdf(job.data as ShippingListDocument | any);
    } catch (error) {
      this.logger.error(error);
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.verbose(
      `Job ${job.id} para la lista de envíos #${job.data.reference} está en ejecución...`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `Job ${job.id} para la lista de envíos #${job.data.reference} completado.`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job<any>, error: any) {
    this.logger.error(
      `Job ${job.id} para la lista de envíos #${job.data.reference} falló con error:`,
      error,
    );
  }

  async generatePdf(shippingList: any) {
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
                    text: shippingList?.date.toLocaleString() || '',
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
                      ? currencyFormatter.format(
                          parseFloat(order.cash_amount.replace('.', '')),
                        )
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
              this.client.emit('create-websocket-notification', {
                success: true,
                data: { pdf: cloudinaryResult.secure_url, model_id: shippingList._id },
                room: shippingList.parent_id,
                model: 'shipping_list',
              });
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
      this.logger.error(error);
    }
  }
}
