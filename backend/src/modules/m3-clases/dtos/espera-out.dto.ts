import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class EsperaOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 4 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  clase_id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  socio_id!: number;

  @ApiProperty({
    example: 'EN_ESPERA',
    enum: ['EN_ESPERA', 'NOTIFICADO', 'CONFIRMADO', 'CANCELADO'],
  })
  @Expose()
  estado!: string;

  @ApiProperty({ example: '2026-10-14T10:00:00.000Z' })
  @Expose()
  fecha_anotacion!: Date;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: false,
    example: null,
    nullable: true,
  })
  @Expose()
  fecha_notificacion!: Date | null;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: false,
    example: null,
    nullable: true,
  })
  @Expose()
  fecha_confirmacion!: Date | null;
}
