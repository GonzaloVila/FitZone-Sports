import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SocioOutDto {
  @Expose()
  @ApiProperty({ type: 'integer', example: 2 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  usuario_id!: number;

  @Expose()
  @ApiProperty({ example: 'Ana Gómez' })
  nombre!: string;

  @Expose()
  @ApiProperty({ format: 'email', example: 'ana.gomez@fitzone.com.ar' })
  email!: string;

  @Expose()
  @ApiProperty({ type: 'integer', example: 3 })
  sede_origen_id!: number;

  @Expose()
  @ApiProperty({ example: '2026-09-15' })
  fecha_alta!: Date;
}
