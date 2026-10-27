import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';
import { Cancha } from '../entities/cancha.entity';
import { ListarCanchasQueryDto } from './listar-canchas-query.dto';

const TIPOS: Cancha['tipo'][] = ['PADDLE', 'FUTBOL5'];

// Query de GET /canchas (todas las sedes). Suma `sedeId` y `tipo` al de listado por
// sede; `estado`, `page` y `perPage` (con sus reglas y defaults) se heredan tal cual.
export class BuscarCanchasQueryDto extends ListarCanchasQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    description: 'ID numérico de la sede. Si no existe, la lista vuelve vacía.',
    example: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sedeId?: number;

  @ApiPropertyOptional({
    enum: TIPOS,
    description: 'Filtro por tipo de cancha (PADDLE | FUTBOL5). Si se omite, devuelve ambos.',
  })
  @IsOptional()
  @IsIn(TIPOS)
  tipo?: Cancha['tipo'];
}
