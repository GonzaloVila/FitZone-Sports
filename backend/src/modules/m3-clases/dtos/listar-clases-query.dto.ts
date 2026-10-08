import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class ListarClasesQueryDto {
  @ApiPropertyOptional({
    type: 'integer', description: 'Filtrar por ID de la sede', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sedeId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por disciplina o tipo', example: 'Spinning' })
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({
    type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;
}
