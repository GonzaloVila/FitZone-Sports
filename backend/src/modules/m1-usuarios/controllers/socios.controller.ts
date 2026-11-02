import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../../../commons/guards/roles.decorator';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { SocioIn } from '../dtos/socio-in.dto';
import { ListarSociosQueryDto } from '../dtos/listar-socios-query.dto';
import { SocioPatch } from '../dtos/socio-patch.dto';
import { SocioOut } from '../dtos/socio-out.dto';
import { ListaSociosDto } from '../dtos/lista-socios.dto';
import { SociosAccesoService } from '../services/socios-acceso.service';
import { SociosService } from '../services/socios.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';
const SOLO_PERSONAL = 'Rol sin permiso (solo RECEPCION/GERENTE)';

// Todo el controller exige sesion. Alta, listado, modificacion y baja son de RECEPCION y GERENTE (@Roles); leer un socio es
// de cualquier rol, pero el SOCIO solo el suyo y el EXTERNO ninguno (lo decide SociosAccesoService).
@ApiTags('socios')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@Controller('socios')
export class SociosController {
  constructor(
    private readonly sociosService: SociosService,
    private readonly acceso: SociosAccesoService,
  ) {}

  @Post()
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'crearSocio', summary: 'Alta de socio (RF-02)' })
  @ApiCreatedResponse({
    description: 'Socio creado (y su membresía inicial si se indicó plan)',
    type: SocioOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/socios/2' } },
    },
  })
  @ApiBadRequestResponse({ description: 'Solicitud mal formada (JSON inválido)', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: SOLO_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Usuario a convertir no existe (404)', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'El usuario ya es socio (conflicto de unicidad)',
    content: PROBLEM_JSON,
  })
  // El alta cobra la membresía inicial (RF-02): si la pasarela rechaza, la
  // operación se revierte y responde 402. Sin declararlo, el contrato prometería
  // un alta que nunca puede fallar así.
  @ApiPaymentRequiredResponse({
    description: 'El cobro de la membresía inicial fue rechazado por la pasarela (RF-02)',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos o referencia inexistente (ValidationPipe/P2003)',
    content: PROBLEM_JSON,
  })
  async crear(
    @Body() dto: SocioIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocioOut> {
    const socio = await this.sociosService.crear(dto);
    res.setHeader('Location', `/api/v1/socios/${socio.id}`);
    return socio;
  }

  // Antes que @Get(':socioId') por el mismo motivo que en UsuariosController.
  @Get()
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'listarSocios', summary: 'Listado de socios con filtros' })
  @ApiOkResponse({ description: 'Listado de socios', type: ListaSociosDto })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: SOLO_PERSONAL, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() dto: ListarSociosQueryDto): Promise<ListaSociosDto> {
    return this.sociosService.listar(dto);
  }

  @Get(':socioId')
  @ApiOperation({ operationId: 'obtenerSocio', summary: 'Obtener socio por id' })
  @ApiParam({ name: 'socioId', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Socio encontrado', type: SocioOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente (o ajeno, para SOCIO y EXTERNO)', content: PROBLEM_JSON })
  obtener(@Param('socioId', ParseIntPipe) socioId: number, @Req() req: RequestConUsuario): Promise<SocioOut> {
    return this.acceso.obtener(req.user, socioId);
  }

  @Patch(':socioId')
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'modificarSocio', summary: 'Modificar parcialmente un socio' })
  @ApiParam({ name: 'socioId', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Socio actualizado', type: SocioOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: SOLO_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos o sede de origen inexistente (P2003)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: SocioPatch,
  ): Promise<SocioOut> {
    return this.sociosService.modificar(socioId, dto);
  }

  @Delete(':socioId')
  @Roles('RECEPCION', 'GERENTE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'dejarDeSerSocio', summary: 'Dejar de ser socio' })
  @ApiParam({ name: 'socioId', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiNoContentResponse({ description: 'Socio dado de baja (sin cuerpo)' })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: SOLO_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  eliminar(@Param('socioId', ParseIntPipe) socioId: number): Promise<void> {
    return this.sociosService.dejarDeSerSocio(socioId);
  }
}
