import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SocioOut {
  // Identidad
  @Expose()
  @ApiProperty({ type: 'integer', example: 2 })
  id!: number;

  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  usuario_id!: number;

  // Origen y alta
  @Expose()
  @ApiProperty({ type: 'integer', example: 3 })
  sede_origen_id!: number;

  @Expose()
  @ApiProperty({ example: '2026-09-15T00:00:00-03:00' })
  fecha_alta!: Date;

  // Datos de contacto
  @Expose()
  @ApiProperty({ example: 'Ana Gómez' })
  nombre!: string;

  @Expose()
  @ApiProperty({ format: 'email', example: 'ana.gomez@fitzone.com.ar' })
  email!: string;
}
