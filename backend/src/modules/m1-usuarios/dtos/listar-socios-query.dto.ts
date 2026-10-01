import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { EstadoMembresia } from '../entities/membresia.entity';
import type { PlanMembresia } from '../entities/membresia.entity';

const ESTADOS: EstadoMembresia[] = ['ACTIVA', 'VENCIDA', 'SUSPENDIDA'];
const PLANES: PlanMembresia[] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];

export class ListarSociosQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    description: 'ID numérico de la sede de origen',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sede_origen_id?: number;

  @ApiPropertyOptional({
    enum: ESTADOS,
    description: 'Estado de la membresía asociada al socio.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado_membresia?: EstadoMembresia;

  @ApiPropertyOptional({
    enum: PLANES,
    description: 'Plan de la membresía asociada al socio.',
  })
  @IsOptional()
  @IsIn(PLANES)
  plan?: PlanMembresia;

  @ApiPropertyOptional({
    description:
      'Coincidencia parcial sobre el nombre del usuario asociado, sin distinguir mayusculas.',
    example: 'Ana',
  })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number = 20;
}
