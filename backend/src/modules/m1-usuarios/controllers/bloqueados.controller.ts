import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../../../commons/guards/jwt-auth.guard';
import { Roles } from '../../../commons/guards/roles.decorator';
import { RolesGuard } from '../../../commons/guards/roles.guard';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { BloqueadosOut } from '../dtos/bloqueados-out.dto';
import { ListarBloqueadosQueryDto } from '../dtos/listar-bloqueados-query.dto';
import { MembresiasService } from '../services/membresias.service';

// RF-04 (Unidad III, Fase 4): el puesto de control offline (RNF-01) descarga
// esta lista mientras tiene conexion y la consulta localmente cuando la
// pierde, en vez de validar TOTP sin red (ver decisiones del plan). Es mas
// simple que validar TOTP offline y reusa el mismo cron que ya vence
// membresias para M2.
@ApiTags('bloqueados')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@Controller('bloqueados')
export class BloqueadosController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({
    operationId: 'listarBloqueados',
    summary: 'Lista de usuarios NO vigentes (para sincronizar offline)',
  })
  @ApiOkResponse({ description: 'Listado de no vigentes', type: BloqueadosOut })
  @ApiUnauthorizedResponse({ description: 'Token inválido, expirado o ausente', content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: 'Rol sin permiso (solo RECEPCION/GERENTE)', content: PROBLEM_JSON })
  async listar(@Query() dto: ListarBloqueadosQueryDto): Promise<BloqueadosOut> {
    // Epoch como default: sin ?actualizado_desde= trae el universo completo
    // de no vigentes, que es lo que necesita la primera sincronizacion de un
    // puesto nuevo (todavia sin lista local contra la que comparar).
    const desde = dto.actualizado_desde ? new Date(dto.actualizado_desde) : new Date(0);
    const noVigentes = await this.membresiasService.buscarNoVigentes(desde);

    return plainToInstance(BloqueadosOut, {
      bloqueados: noVigentes.map((item) => ({
        socio_id: item.socioId,
        motivo: item.motivo,
        desde: item.desde.toISOString(),
      })),
      total: noVigentes.length,
      servidor_time: new Date().toISOString(),
    });
  }
}
