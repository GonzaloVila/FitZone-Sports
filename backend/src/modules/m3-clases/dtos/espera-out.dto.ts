import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class EsperaOutDto {
  @ApiProperty({ example: 4 })
  @Expose()
  id!: number;

  @ApiProperty({ example: 1 })
  @Expose()
  clase_id!: number;

  @ApiProperty({ example: 1 })
  @Expose()
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

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  fecha_notificacion!: Date | null;

  @ApiProperty({ example: null, nullable: true })
  @Expose()
  fecha_confirmacion!: Date | null;
}
