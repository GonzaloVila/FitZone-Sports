import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../../../commons/guards/roles.decorator';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { SincronizarIngresosIn } from '../dtos/sincronizar-ingresos-in.dto';
import { SincronizarIngresosOut } from '../dtos/sincronizar-ingresos-out.dto';
import { sinSedeAsignada } from '../errors/ingresos.errors';
import { IngresosService } from '../services/ingresos.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

// RNF-01, Fase 5: el recepcionista sincroniza el lote que su puesto acumulo
// sin conexion. sedeId sale del JWT (nunca del body): un RECEPCION solo
// puede sincronizar ingresos de la sede en la que esta registrado como staff
// (EmpleadoSede, resuelto al loguear en AuthService).
@ApiTags('ingresos')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@Controller('sincronizacion')
export class SincronizacionController {
  constructor(private readonly ingresosService: IngresosService) {}

  @Post('ingresos')
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({
    operationId: 'sincronizarIngresos',
    summary: 'Sincroniza lote de ingresos/egresos offline (RNF-01)',
  })
  @ApiCreatedResponse({ description: 'Lote procesado (resultado por item)', type: SincronizarIngresosOut })
  @ApiUnauthorizedResponse({ description: 'Token inválido, expirado o ausente', content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: 'Rol sin permiso (solo RECEPCION o GERENTE) o sin sede asignada', content: PROBLEM_JSON })
  sincronizar(
    @Body() dto: SincronizarIngresosIn,
    @Req() req: RequestConUsuario,
  ): Promise<SincronizarIngresosOut> {
    const sedeId = req.user.sedeId;
    if (sedeId === undefined) {
      throw sinSedeAsignada();
    }
    return this.ingresosService.sincronizar(dto, sedeId);
  }
}
