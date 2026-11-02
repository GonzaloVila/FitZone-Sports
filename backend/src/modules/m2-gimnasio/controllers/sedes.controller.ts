import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../../../commons/guards/roles.decorator';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { AforoOut } from '../dtos/aforo-out.dto';
import { ListarSedesQueryDto } from '../dtos/listar-sedes-query.dto';
import { SedeIn } from '../dtos/sede-in.dto';
import { SedeOut } from '../dtos/sede-out.dto';
import { ListaSedesDto } from '../dtos/lista-sedes.dto';
import { IngresosAccesoService } from '../services/ingresos-acceso.service';
import { SedesService } from '../services/sedes.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';

// Todo el controller exige sesion. Sin @Roles (listar) cualquier rol entra; el alta es de GERENTE y el aforo de
// RECEPCION (solo su sede, lo decide IngresosAccesoService) y GERENTE.
@ApiTags('sedes')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@Controller('sedes')
export class SedesController {
  constructor(
    private readonly sedesService: SedesService,
    private readonly acceso: IngresosAccesoService,
  ) {}

  @Get()
  @ApiOperation({ operationId: 'listarSedes', summary: 'Listado de sedes' })
  @ApiOkResponse({ description: 'Listado de sedes', type: ListaSedesDto })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Parámetros de paginación inválidos', content: PROBLEM_JSON })
  listar(@Query() query: ListarSedesQueryDto): Promise<ListaSedesDto> {
    return this.sedesService.listar(query.page ?? 1, query.perPage ?? 20);
  }

  @Post()
  @Roles('GERENTE')
  @ApiOperation({ operationId: 'crearSede', summary: 'Alta de sede' })
  @ApiCreatedResponse({
    description: 'Sede creada',
    type: SedeOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/sedes/3' } },
    },
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: 'Rol sin permiso (solo GERENTE)', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Body() dto: SedeIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SedeOut> {
    const sede = await this.sedesService.crear(dto);
    res.setHeader('Location', `/api/v1/sedes/${sede.id}`);
    return sede;
  }

  @Get(':sedeId/aforo')
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'obtenerAforo', summary: 'Aforo actual de una sede (RF-05)' })
  @ApiParam({ name: 'sedeId', type: 'integer', description: 'ID numérico de la sede', example: 3 })
  @ApiOkResponse({ description: 'Aforo actual de la sede', type: AforoOut })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({
    description: 'Rol sin permiso (solo RECEPCION/GERENTE) o sede que no es la del recepcionista',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({ description: 'Sede inexistente', content: PROBLEM_JSON })
  obtenerAforo(@Param('sedeId', ParseIntPipe) sedeId: number, @Req() req: RequestConUsuario): Promise<AforoOut> {
    return this.acceso.aforo(req.user, sedeId);
  }
}
