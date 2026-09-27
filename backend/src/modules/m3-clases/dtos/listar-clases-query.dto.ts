import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class ListarClasesQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de la sede', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  sede_id?: number;

  @ApiPropertyOptional({ description: 'Filtrar por fecha (YYYY-MM-DD o prefijo)', example: '2026-10-15' })
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional({ description: 'Filtrar por disciplina o tipo', example: 'Spinning' })
  @IsOptional()
  @IsString()
  tipo?: string;
}
