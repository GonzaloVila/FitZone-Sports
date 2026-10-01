import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';
import { PlanMembresia } from '../entities/membresia.entity';

const PLANES: PlanMembresia[] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];

export class SocioIn {
  @ApiProperty({
    type: 'integer',
    description: 'Usuario a convertir en socio (RF-01/RF-02).',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  usuario_id!: number;

  @ApiProperty({
    type: 'integer',
    description: 'Sede de origen (informativa; el acceso multi-sede lo garantiza la membresía, RF-03).',
    example: 3,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sede_origen_id!: number;

  @ApiProperty({
    enum: PLANES,
    description:
      'Plan de la membresía inicial, obligatorio: no existe un socio sin membresía. El alta crea la fila única de Membresia en la misma transacción y la fecha_fin se calcula en el dominio con este plan.',
  })
  @IsIn(PLANES)
  plan!: PlanMembresia;
}
