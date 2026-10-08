import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class ResultadoIngresoOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  localId!: number;

  @Expose()
  @ApiProperty({ example: true })
  ok!: boolean;

  @Expose()
  @ApiPropertyOptional({ type: 'integer', example: 987, description: 'ID del ingreso en el servidor. Solo si ok:true.' })
  serverId?: number;

  @Expose()
  @ApiPropertyOptional({ enum: ['USUARIO_BLOQUEADO', 'YA_DENTRO', 'AFORO_LLENO'], example: 'USUARIO_BLOQUEADO' })
  error?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Membresía VENCIDA' })
  detalle?: string;
}

@Exclude()
export class ResultadoEgresoOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 1 })
  localId!: number;

  @Expose()
  @ApiProperty({ example: true })
  ok!: boolean;

  @Expose()
  @ApiPropertyOptional({ enum: ['INGRESO_NO_ENCONTRADO', 'EGRESO_DUPLICADO'], example: 'INGRESO_NO_ENCONTRADO' })
  error?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'No se encontró el ingreso local 1 en este lote.' })
  detalle?: string;
}

@Exclude()
export class SincronizarIngresosOut {
  @Expose()
  @Type(() => ResultadoIngresoOut)
  @ApiProperty({ type: [ResultadoIngresoOut] })
  resultados!: ResultadoIngresoOut[];

  @Expose()
  @Type(() => ResultadoEgresoOut)
  @ApiProperty({ type: [ResultadoEgresoOut] })
  egresosProcesados!: ResultadoEgresoOut[];
}
