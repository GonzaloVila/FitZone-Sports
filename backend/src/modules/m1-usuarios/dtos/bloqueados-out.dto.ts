import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
export class BloqueadoItemOut {
  @Expose()
  @ApiProperty({ type: 'integer', example: 123 })
  socioId!: number;

  @Expose()
  @ApiProperty({ enum: ['VENCIDA', 'SUSPENDIDA'], example: 'VENCIDA' })
  motivo!: 'VENCIDA' | 'SUSPENDIDA';

  @Expose()
  @ApiProperty({ example: '2026-10-03T00:00:00Z', description: 'Desde cuándo dejó de ser vigente.' })
  desde!: string;
}

@Exclude()
export class BloqueadosOut {
  @Expose()
  @Type(() => BloqueadoItemOut)
  @ApiProperty({ type: [BloqueadoItemOut] })
  bloqueados!: BloqueadoItemOut[];

  @Expose()
  @ApiProperty({ type: 'integer', example: 2 })
  total!: number;

  @Expose()
  @ApiProperty({ example: '2026-10-03T03:05:00Z', description: 'Hora del servidor al responder.' })
  servidorTime!: string;
}
