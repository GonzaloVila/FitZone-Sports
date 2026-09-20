import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { PlanMembresia } from '../entities/socio.entity';

const PLANES: PlanMembresia[] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];

export class CrearSocioDto {
  @ApiProperty({ description: 'Usuario a convertir en socio (RF-01/RF-02).' })
  @IsInt()
  @Min(1)
  usuario_id!: number;

  @ApiProperty({
    description: 'Sede de origen (informativa; el acceso multi-sede lo garantiza la membresía, RF-03).',
  })
  @IsInt()
  @Min(1)
  sede_origen_id!: number;

  @ApiPropertyOptional({
    enum: PLANES,
    description: 'Si se indica, se crea la membresía inicial con este plan en la misma transacción.',
  })
  @IsOptional()
  @IsIn(PLANES)
  plan?: PlanMembresia;
}
