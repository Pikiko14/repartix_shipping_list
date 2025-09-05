import { Controller } from '@nestjs/common';
import { ShippingListService } from './shipping-list.service';
import { QueryParamDto } from 'src/commons/dto/query-param.dto';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateShippingListDto } from './dto/create-shipping-list.dto';
import { UpdateShippingListDto } from './dto/update-shipping-list.dto';
import { DeleteShippingListDto } from './dto/delete-shipping-list.dto';

@Controller()
export class ShippingListController {
  constructor(private readonly shippingListService: ShippingListService) {}

  @MessagePattern('create-shipping-list')
  create(@Payload() createShippingListDto: CreateShippingListDto) {
    return this.shippingListService.create(createShippingListDto);
  }

  @MessagePattern('find-all-shipping-list')
  findAll(@Payload() queryParamsDto: QueryParamDto) {
    return this.shippingListService.findAll(queryParamsDto);
  }

  @MessagePattern('find-one-shipping-list')
  findOne(@Payload() findIdDto: DeleteShippingListDto) {
    return this.shippingListService.findOne(findIdDto);
  }

  @MessagePattern('update-shipping-list')
  update(@Payload() updateShippingListDto: UpdateShippingListDto) {
    return this.shippingListService.update(updateShippingListDto.id, updateShippingListDto);
  }

  @MessagePattern('remove-shipping-list')
  remove(@Payload() deleteShippingList: DeleteShippingListDto) {
    return this.shippingListService.remove(deleteShippingList);
  }

  @MessagePattern('update-shipping-list-order')
  updateOrderStatus(@Payload() updateOrderStatus: any) {
    return this.shippingListService.updateOrderStatus(updateOrderStatus);
  }

  @MessagePattern('print-shipping-list-pdf')
  printPdf(@Payload() printPdfDto: DeleteShippingListDto) {
    return this.shippingListService.printPdf(printPdfDto);
  }

  @MessagePattern('close-shipping-list')
  closeShippingList(@Payload() updateShippingDto: UpdateShippingListDto) {
    return this.shippingListService.closeShippingList(updateShippingDto);
  }
}
