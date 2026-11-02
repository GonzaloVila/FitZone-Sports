import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
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
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../../../commons/guards/roles.decorator';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { EsperaIn } from '../dtos/espera-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarEsperasClaseQueryDto } from '../dtos/listar-esperas-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { ListaEsperasDto } from '../dtos/lista-esperas.dto';
import { ClasesAccesoService } from '../services/clases-acceso.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';
const NO_ES_SOCIO_NI_PERSONAL = 'Rol sin permiso (el EXTERNO no usa clases: solo SOCIO, RECEPCION y GERENTE)';

// Todo el controller exige sesion y el EXTERNO nunca entra (no es socio). El SOCIO solo se anota, ve, sale y confirma lo
// suyo (lo ajeno responde 404 y el listado se fuerza con su socioId); RECEPCION y GERENTE operan todo. Lo decide
// ClasesAccesoService.
@ApiTags('esperas-clases')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@Roles('SOCIO', 'RECEPCION', 'GERENTE')
@Controller()
export class EsperasClasesController {
  constructor(private readonly acceso: ClasesAccesoService) {}

  @Post('clases/:claseId/espera')
  @ApiOperation({
    operationId: 'anotarseEnEspera',
    summary: 'Anotarse en la lista de espera de una clase (RF-08)',
  })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID de la clase completa', example: 1 })
  @ApiCreatedResponse({
    description: 'Inscripción en lista de espera registrada exitosamente',
    type: EsperaOut,
    headers: {
      Location: {
        description: 'URL de acceso a la solicitud de espera',
        schema: { type: 'string', example: '/api/v1/esperas-clases/4' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({
    description:
      'Tiene dos significados, ambos con problem+json: rol sin permiso (el EXTERNO no usa clases) o sesión de socio sin ' +
      'socioId; y socio en mora',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({
    description: 'Clase o socio no encontrado (un SOCIO que manda el socioId de otro recibe este 404)',
    content: PROBLEM_JSON,
  })
  @ApiConflictResponse({
    description:
      'La clase todavía tiene cupos libres, el socio ya tiene una espera o una reserva activa ' +
      'para esa clase, o la clase ya comenzó o finalizó.',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  async anotarse(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Body() dto: EsperaIn,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EsperaOut> {
    const espera = await this.acceso.anotarse(req.user, claseId, dto);
    res.setHeader('Location', `/api/v1/esperas-clases/${espera.id}`);
    return espera;
  }

  @Get('esperas-clases/:esperaId')
  @ApiOperation({
    operationId: 'obtenerEspera',
    summary: 'Obtener anotación de espera por id',
  })
  @ApiParam({ name: 'esperaId', type: 'integer', description: 'ID de la solicitud de espera', example: 4 })
  @ApiOkResponse({ description: 'Detalle de la solicitud de espera', type: EsperaOut })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({
    description: 'Solicitud de espera no encontrada (o ajena, para un SOCIO)',
    content: PROBLEM_JSON,
  })
  obtener(@Param('esperaId', ParseIntPipe) esperaId: number, @Req() req: RequestConUsuario): Promise<EsperaOut> {
    return this.acceso.obtenerEspera(req.user, esperaId);
  }

  @Delete('esperas-clases/:esperaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'salirDeEspera',
    summary: 'Salir de la lista de espera (baja lógica)',
  })
  @ApiParam({ name: 'esperaId', type: 'integer', description: 'ID de la espera a cancelar', example: 4 })
  @ApiNoContentResponse({ description: 'Solicitud de espera dada de baja lógicamente (CANCELADO)' })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada (o ajena, para un SOCIO)', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'La solicitud ya fue confirmada previamente',
    content: PROBLEM_JSON,
  })
  salir(@Param('esperaId', ParseIntPipe) esperaId: number, @Req() req: RequestConUsuario): Promise<void> {
    return this.acceso.salirDeEspera(req.user, esperaId);
  }

  @Post('esperas-clases/:esperaId/confirmaciones')
  @ApiOperation({
    operationId: 'confirmarEspera',
    summary: 'Confirmar cupo desde la lista de espera (RF-08)',
  })
  @ApiParam({ name: 'esperaId', type: 'integer', description: 'ID de la espera notificada', example: 4 })
  @ApiCreatedResponse({
    description: 'Cupo confirmado y convertido a reserva de clase exitosamente',
    type: ReservaClaseOut,
    headers: {
      Location: {
        description: 'URL de acceso a la reserva creada',
        schema: { type: 'string', example: '/api/v1/reservas-clases/5' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Solicitud no encontrada (o ajena, para un SOCIO)', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'La espera no está notificada o el cupo fue tomado por otro socio',
    content: PROBLEM_JSON,
  })
  async confirmar(
    @Param('esperaId', ParseIntPipe) esperaId: number,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservaClaseOut> {
    const reserva = await this.acceso.confirmarEspera(req.user, esperaId);
    res.setHeader('Location', `/api/v1/reservas-clases/${reserva.id}`);
    return reserva;
  }

  @Get('esperas-clases')
  @ApiOperation({
    operationId: 'listarEsperasClase',
    summary: 'Listado de anotaciones de espera con filtros',
  })
  @ApiOkResponse({
    description: 'Listado de solicitudes en lista de espera',
    type: ListaEsperasDto,
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() query: ListarEsperasClaseQueryDto, @Req() req: RequestConUsuario): Promise<ListaEsperasDto> {
    return this.acceso.listarEsperas(req.user, query);
  }
}
