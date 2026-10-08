import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class EsperaOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 4 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  claseId!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  socioId!: number;

  @ApiProperty({
    example: 'EN_ESPERA',
    enum: ['EN_ESPERA', 'NOTIFICADO', 'CONFIRMADO', 'CANCELADO'],
  })
  @Expose()
  estado!: string;

  @ApiProperty({ example: '2026-10-14T10:00:00.000Z' })
  @Expose()
  fechaAnotacion!: Date;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: false,
    example: null,
    nullable: true,
  })
  @Expose()
  fechaNotificacion!: Date | null;

  @ApiProperty({
    type: 'string',
    format: 'date-time',
    required: false,
    example: null,
    nullable: true,
  })
  @Expose()
  fechaConfirmacion!: Date | null;
}
