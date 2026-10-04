import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class ListarBloqueadosQueryDto {
  @ApiPropertyOptional({
    description:
      'Sincronización incremental: solo devuelve los que cambiaron de vigencia ' +
      'desde este instante. Sin el parámetro, trae el listado completo de no vigentes.',
    example: '2026-10-03T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  actualizado_desde?: string;
}
