import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PlanMembresia } from '../entities/socio.entity';

const PLANES: PlanMembresia[] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];

export class CrearMembresiaDto {
  @ApiProperty({
    enum: PLANES,
    description: 'Plan de membresía: MENSUAL (+1 mes), TRIMESTRAL (+3 meses) o ANUAL (+1 año).',
    example: 'MENSUAL',
  })
  @IsIn(PLANES)
  plan!: PlanMembresia;

  @ApiPropertyOptional({
    description: 'Si se renueva automáticamente al vencer.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  renueva_automatica?: boolean;

  @ApiPropertyOptional({
    description: 'Fecha de inicio de la membresía (ISO 8601). Por defecto la fecha actual.',
    example: '2026-09-20',
  })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({
    description: 'ID del socio (opcional si se especifica en la ruta).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  socio_id?: number;
}
