import { IsString, IsOptional } from 'class-validator';

export class DeleteShippingListDto {
  @IsString()
  @IsOptional()
  id: string;

  @IsString()
  @IsOptional()
  parent_id: string;
}
