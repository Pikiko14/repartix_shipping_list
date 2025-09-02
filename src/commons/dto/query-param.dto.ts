import { IsString, IsOptional } from 'class-validator';

export class QueryParamDto {
  @IsOptional()
  parent_id?: string;

  @IsString()
  @IsOptional()
  page: string;

  @IsString()
  @IsOptional()
  perPage: string;

  @IsString()
  @IsOptional()
  search?: string;
}
