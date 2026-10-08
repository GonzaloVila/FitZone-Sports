import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsISO8601, Matches, Min } from 'class-validator';

// date-time RFC 3339 exige zona. IsISO8601 solo acepta también "2026-10-05T18:00"
// o "2026-10-05", que new Date() interpreta en la zona del proceso: la reserva
// quedaría en otra hora según dónde corra el server. Se exige Z u offset.
const CON_ZONA = /(Z|[+-]\d{2}:\d{2})$/;
const MENSAJE_ZONA = 'debe incluir zona horaria (Z o ±hh:mm)';

export class ReservaCanchaIn {
  @ApiProperty({ type: 'integer', description: 'Cancha a reservar (RF-10).', example: 1 })
  @IsInt()
  @Min(1)
  canchaId!: number;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Inicio del turno (ISO-8601 con zona horaria).',
    example: '2026-10-05T19:00:00-03:00',
  })
  @IsISO8601({ strict: true })
  @Matches(CON_ZONA, { message: `fecha_hora_inicio ${MENSAJE_ZONA}` })
  fechaHoraInicio!: string;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    description: 'Fin del turno (ISO-8601 con zona horaria). Debe ser posterior al inicio.',
    example: '2026-10-05T20:00:00-03:00',
  })
  @IsISO8601({ strict: true })
  @Matches(CON_ZONA, { message: `fecha_hora_fin ${MENSAJE_ZONA}` })
  fechaHoraFin!: string;

  // Obligatorio en el DTO aunque el contrato lo marca opcional: todavía no hay
  // autenticación que permita derivarlo del token (decisión 13 del plan M4).
  @ApiProperty({ type: 'integer', description: 'Usuario que reserva (socio o externo).', example: 2 })
  @IsInt()
  @Min(1)
  usuarioId!: number;
}
