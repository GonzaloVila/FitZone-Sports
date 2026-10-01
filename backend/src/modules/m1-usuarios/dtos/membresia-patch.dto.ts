import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { EstadoMembresia } from '../entities/membresia.entity';
import { PlanMembresia } from '../entities/membresia.entity';

const PLANES: PlanMembresia[] = ['MENSUAL', 'TRIMESTRAL', 'ANUAL'];

// Estados que el endpoint acepta de entrada. VENCIDA queda afuera a propósito: solo
// lo produce el proceso diario que vence las membresías cuya fecha_fin ya pasó.
// Aceptarlo por API permitía dejar un VENCIDA con fecha_fin futura, y esa fila la
// daba por vigente `estaVigente` (m.estado !== 'SUSPENDIDA' && fecha_fin >= ahora).
const ESTADOS: EstadoMembresia[] = ['ACTIVA', 'SUSPENDIDA'];

export class MembresiaPatch {
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