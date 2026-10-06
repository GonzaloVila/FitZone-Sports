import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export class IngresoASincronizarDto {
  @ApiProperty({
    type: 'integer',
    description: 'ID asignado por el puesto offline (no es el id del servidor).',
    example: 1,
  })
  @IsInt()
  @Min(1)
  local_id!: number;

  @ApiProperty({ type: 'integer', description: 'Socio que ingresó.', example: 123 })
  @IsInt()
  @Min(1)
  socio_id!: number;

  @ApiProperty({
    description: 'Momento real del acceso, registrado por el puesto mientras estaba sin conexión.',
    example: '2026-10-03T22:15:00Z',
  })
  @IsDateString()
  fecha_hora_ingreso!: string;
}

export class EgresoASincronizarDto {
  @ApiProperty({
    type: 'integer',
    description: 'ID asignado por el puesto offline a este egreso.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  local_id!: number;

  @ApiProperty({
    type: 'integer',
    description: 'local_id del ingreso correspondiente, DEL MISMO LOTE (ver `ingresos`).',
    example: 1,
  })
  @IsInt()
  @Min(1)
  ingreso_local_id!: number;

  @ApiProperty({ description: 'Momento real del egreso.', example: '2026-10-03T23:00:00Z' })
  @IsDateString()
  fecha_hora_egreso!: string;
}

export class SincronizarIngresosIn {
  @ApiProperty({ type: [IngresoASincronizarDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngresoASincronizarDto)
  ingresos!: IngresoASincronizarDto[];

  @ApiPropertyOptional({ type: [EgresoASincronizarDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EgresoASincronizarDto)
  egresos?: EgresoASincronizarDto[];
}
