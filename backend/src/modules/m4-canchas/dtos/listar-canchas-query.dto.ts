import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Cancha } from '../entities/cancha.entity';

const ESTADOS: Cancha['estado'][] = ['OPERATIVA', 'EN_MANTENIMIENTO'];

export class ListarCanchasQueryDto {
  @ApiPropertyOptional({ enum: ESTADOS, description: 'Filtra por estado (RF-12 no oculta las no operativas si se omite).' })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Cancha['estado'];

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;
}
