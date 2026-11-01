import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { ESTADOS_CLASE, type EstadoClase } from '../entities/clase.entity';

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

  // Sin `default` a propósito: sin `estado` se devuelven todas las clases. El enum y la descripción tienen que coincidir con
  // `docs/openapi.yaml`.
  @ApiPropertyOptional({
    type: 'string',
    enum: ESTADOS_CLASE,
    description:
      'Estado de la clase: COMENZADA (ya empezó), SIN_CUPOS (todavía no empezó y no quedan cupos) o CON_CUPOS ' +
      '(todavía no empezó y quedan cupos). Sin este parámetro devuelve las clases en cualquier estado.',
    example: 'CON_CUPOS',
  })
  @IsOptional()
  @IsIn(ESTADOS_CLASE)
  estado?: EstadoClase;

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
