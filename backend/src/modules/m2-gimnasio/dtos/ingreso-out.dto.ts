import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class IngresoOutDto {
  @Expose()
  @ApiProperty({ example: 9 })
  id!: number;

  @Expose()
  @ApiProperty({ example: 3 })
  sede_id!: number;

  @Expose()
  @ApiProperty({ example: 2 })
  usuario_id!: number;

  @Expose()
  @ApiProperty({ example: '2026-09-16T18:02:11-03:00' })
  fecha_hora_ingreso!: Date;

  @Expose()
  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Null mientras el usuario permanezca dentro de la sede (define el aforo, RN-01).',
  })
  fecha_hora_egreso!: Date | null;

  @Expose()
  @ApiProperty({ example: false, description: 'true si se registró vía puesto offline (RNF-01).' })
  validado_offline!: boolean;
}
