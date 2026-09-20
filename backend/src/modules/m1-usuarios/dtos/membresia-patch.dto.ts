import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { EstadoMembresia } from '../entities/membresia.entity';
import { PlanMembresia } from '../entities/socio.entity';

const PLANES: PlanMembresia[] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];
const ESTADOS: EstadoMembresia[] = ['ACTIVA', 'VENCIDA', 'SUSPENDIDA'];

export class MembresiaPatchDto {
  @ApiPropertyOptional({
    enum: PLANES,
    description: 'Cambia el plan y recalcula fecha_fin sobre la fecha actual.',
  })
  @IsOptional()
  @IsIn(PLANES)
  plan?: PlanMembresia;

  @ApiPropertyOptional({
    description: 'false frena la renovación automática al vencer.',
  })
  @IsOptional()
  @IsBoolean()
  renueva_automatica?: boolean;

  @ApiPropertyOptional({
    enum: ESTADOS,
    description: 'Suspende una membresía activa (SUSPENDIDA) o la vuelve a ACTIVA.',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoMembresia;
}