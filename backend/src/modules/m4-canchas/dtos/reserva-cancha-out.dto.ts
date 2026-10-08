import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Reserva } from '../entities/reserva.entity';

const ESTADOS: Reserva['estado'][] = ['CONFIRMADA', 'CANCELADA'];

@Exclude()
export class ReservaCanchaOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 7 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  canchaId!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 2 })
  usuarioId!: number;

  @Expose()
  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-10-05T19:00:00-03:00' })
  fechaHoraInicio!: Date;

  @Expose()
  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-10-05T20:00:00-03:00' })
  fechaHoraFin!: Date;

  @Expose()
  @ApiProperty({ enum: ESTADOS, example: 'CONFIRMADA' })
  estado!: Reserva['estado'];

  @Expose()
  @ApiProperty({
    type: 'number',
    description: 'Precio final cotizado al reservar (descuento de socio y recargo de horario pico incluidos, RF-11).',
    example: 5100,
  })
  precioAplicado!: number;
}
