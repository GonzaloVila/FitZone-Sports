import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { EstadoEspera } from '../entities/espera-clase.entity';

const ESTADOS: EstadoEspera[] = ['EN_ESPERA', 'NOTIFICADO', 'CONFIRMADO', 'CANCELADO'];

export class ListarEsperaDeClaseQueryDto {
  @ApiPropertyOptional({
    enum: ESTADOS,
    description: 'Estado de la solicitud en lista de espera.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoEspera;

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
