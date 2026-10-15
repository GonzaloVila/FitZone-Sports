import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import type { EstadoReservaClaseDerivado } from '../domain/reserva-clase-estado';

const ESTADOS: EstadoReservaClaseDerivado[] = ['CONFIRMADA', 'CANCELADA', 'CUMPLIDA'];

export class ReservaClaseOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 10 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  claseId!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  socioId!: number;

  @Expose()
  @ApiProperty({
    enum: ESTADOS,
    example: 'CONFIRMADA',
    description: 'Estado efectivo. CUMPLIDA se deriva de la fecha de fin de la clase.',
  })
  estado!: EstadoReservaClaseDerivado;
}
