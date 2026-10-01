import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { EstadoEspera } from '../entities/espera-clase.entity';

const ESTADOS: EstadoEspera[] = ['EN_ESPERA', 'NOTIFICADO', 'CONFIRMADO', 'CANCELADO'];

export class ListarEsperasClaseQueryDto {
  @ApiPropertyOptional({
    type: 'integer', description: 'ID numérico de la clase', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clase_id?: number;

  @ApiPropertyOptional({
    type: 'integer', description: 'ID numérico del socio', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  socio_id?: number;

  @ApiPropertyOptional({
    enum: ESTADOS,
    description: 'Estado de la solicitud en lista de espera.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoEspera;

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
