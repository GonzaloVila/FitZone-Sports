import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { EstadoReservaClase } from '../entities/reserva-clase.entity';

const ESTADOS: EstadoReservaClase[] = ['CONFIRMADA', 'CANCELADA'];

export class ListarReservasDeClaseQueryDto {
  @ApiPropertyOptional({
    enum: ESTADOS,
    description: 'Estado de la reserva.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoReservaClase;

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
  per_page?: number = 20;
}
