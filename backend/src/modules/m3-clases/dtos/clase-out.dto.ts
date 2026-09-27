import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ClaseOutDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ example: 1 })
  @Expose()
  sede_id!: number;

  @ApiProperty({ example: 'Spinning' })
  @Expose()
  tipo!: string;

  @ApiProperty({ example: 'Martín Palermo' })
  @Expose()
  instructor!: string;

  @ApiProperty({ example: '2026-10-15T18:00:00Z' })
  @Expose()
  horario!: string;

  @ApiProperty({ example: 20 })
  @Expose()
  capacidad!: number;

  @ApiProperty({ example: 5, description: 'Cantidad de reservas confirmadas activas' })
  @Expose()
  reservas_confirmadas!: number;

  @ApiProperty({ example: 15, description: 'Cupo disponible en tiempo real' })
  @Expose()
  cupo_disponible!: number;
}
