import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { EstadoReservaClase } from '../entities/reserva-clase.entity';

const ESTADOS: EstadoReservaClase[] = ['CONFIRMADA', 'CANCELADA'];

export class ListarReservasClaseQueryDto {
  @ApiPropertyOptional({
    type: 'integer', description: 'ID numérico de la clase', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  claseId?: number;

  @ApiPropertyOptional({
    type: 'integer', description: 'ID numérico del socio', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  socioId?: number;

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
  perPage?: number = 20;
}
