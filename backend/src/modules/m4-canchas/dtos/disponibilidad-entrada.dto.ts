import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class DisponibilidadEntrada {
  @Expose()
  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-10-05T19:00:00-03:00' })
  fecha_hora_inicio!: Date;

  @Expose()
  @ApiProperty({ type: 'string', format: 'date-time', example: '2026-10-05T20:00:00-03:00' })
  fecha_hora_fin!: Date;

  @Expose()
  @ApiProperty({
    type: 'boolean',
    description: 'false si el tramo se solapa con una reserva confirmada o la cancha está en mantenimiento.',
    example: true,
  })
  disponible!: boolean;
}
