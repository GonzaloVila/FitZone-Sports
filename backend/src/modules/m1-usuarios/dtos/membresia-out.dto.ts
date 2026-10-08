import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { EstadoMembresia } from '../entities/membresia.entity';
import { PlanMembresia } from '../entities/membresia.entity';

@Exclude()
export class MembresiaOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  id!: number;

  @Expose()
  @ApiProperty({ enum: ['MENSUAL', 'TRIMESTRAL', 'ANUAL'], example: 'MENSUAL' })
  plan!: PlanMembresia;

  @Expose()
  @ApiProperty({ enum: ['ACTIVA', 'VENCIDA', 'SUSPENDIDA'], example: 'ACTIVA' })
  estado!: EstadoMembresia;

  @Expose()
  @ApiProperty({ example: '2026-09-15T00:00:00-03:00' })
  fechaInicio!: Date;

  @Expose()
  @ApiProperty({ example: '2026-10-15T00:00:00-03:00' })
  fechaFin!: Date;

  @Expose()
  @ApiProperty({ example: false })
  renuevaAutomatica!: boolean;
}
