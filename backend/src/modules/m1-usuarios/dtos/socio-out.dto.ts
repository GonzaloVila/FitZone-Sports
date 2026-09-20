import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class SocioOutDto {
  @Expose()
  @ApiProperty()
  id: number;

  @Expose()
  @ApiProperty()
  usuario_id: number;

  @Expose()
  @ApiProperty()
  sede_origen_id: number;

  @Expose()
  @ApiProperty({ example: '2026-09-15' })
  fecha_alta: Date;
}
