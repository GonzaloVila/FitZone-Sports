import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class ModificarSocioDto {
  @ApiPropertyOptional({ description: 'Nueva sede de origen del socio.', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sede_origen_id?: number;
}
