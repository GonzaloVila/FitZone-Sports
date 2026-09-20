import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { EstadoMembresia } from '../entities/membresia.entity';
import { PlanMembresia } from '../entities/socio.entity';

@Exclude()
export class MembresiaOutDto {
  @Expose()
  @ApiProperty({ example: 1 })
  id!: number;

  @Expose()
  @ApiProperty({ example: 1 })
  socio_id!: number;

  @Expose()
  @ApiProperty({ enum: ['MENSUAL', 'TRIMESTRAL', 'ANUAL'], example: 'MENSUAL' })
  plan!: PlanMembresia;

  @Expose()
  @ApiProperty({ enum: ['ACTIVA', 'VENCIDA', 'SUSPENDIDA'], example: 'ACTIVA' })
  estado!: EstadoMembresia;

  @Expose()
  @ApiProperty({ example: '2026-09-20T12:00:00.000Z' })
  fecha_inicio!: Date;

  @Expose()
  @ApiProperty({ example: '2026-10-20T12:00:00.000Z' })
  fecha_fin!: Date;

  @Expose()
  @ApiProperty({ example: false })
  renueva_automatica!: boolean;
}
