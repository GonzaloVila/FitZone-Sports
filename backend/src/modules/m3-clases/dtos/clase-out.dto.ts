import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ClaseOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  sedeId!: number;

  @Expose()
  @ApiProperty({ example: 'Spinning' })
  tipo!: string;

  @Expose()
  @ApiProperty({ example: 'Martín Palermo' })
  instructor!: string;

  @Expose()
  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-10-15T18:00:00Z' })
  horario!: string;

  @Expose()
  @ApiProperty({ type: 'integer', example: 20 })
  capacidad!: number;

  @Expose()
  @ApiProperty({
    type: 'integer',
    example: 5,
    description: 'Cantidad de reservas confirmadas activas',
  })
  reservasConfirmadas!: number;

  @Expose()
  @ApiProperty({
    type: 'integer',
    example: 15,
    description: 'Cupo disponible en tiempo real',
  })
  cupoDisponible!: number;
}
