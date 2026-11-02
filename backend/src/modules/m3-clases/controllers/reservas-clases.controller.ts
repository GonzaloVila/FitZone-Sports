import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
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
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../commons/guards/jwt-auth.guard';
import { Roles } from '../../../commons/guards/roles.decorator';
import { RolesGuard } from '../../../commons/guards/roles.guard';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { ReservaClaseIn } from '../dtos/reserva-clase-in.dto';
import { ListarReservasClaseQueryDto } from '../dtos/listar-reservas-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { ListaReservasClaseDto } from '../dtos/lista-reservas-clase.dto';
import { ClasesAccesoService } from '../services/clases-acceso.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';
const NO_ES_SOCIO_NI_PERSONAL = 'Rol sin permiso (el EXTERNO no usa clases: solo SOCIO, RECEPCION y GERENTE)';

// Todo el controller exige sesion y el EXTERNO nunca entra (no es socio). El SOCIO solo reserva, ve y cancela lo suyo (lo
// ajeno responde 404 y el listado se fuerza con su socioId); RECEPCION y GERENTE operan todo. Lo decide ClasesAccesoService.
@ApiTags('reservas-clases')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SOCIO', 'RECEPCION', 'GERENTE')
@Controller()
export class ReservasClasesController {
  constructor(private readonly acceso: ClasesAccesoService) {}

  @Post('reservas-clases')
  @ApiOperation({
    operationId: 'crearReservaClase',
    summary: 'Reservar cupo en una clase',
  })
  @ApiCreatedResponse({
    description: 'Reserva confirmada con éxito',
    type: ReservaClaseOut,
    headers: {
      Location: {
        description: 'URL de acceso a la reserva confirmada',
        schema: { type: 'string', example: '/api/v1/reservas-clases/10' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({
    description:
      'Tiene dos significados, ambos con problem+json: rol sin permiso (el EXTERNO no usa clases) o sesión de socio sin ' +
      'socioId; y socio en mora (type socio-en-mora): cuota vencida no permite reservar con descuento',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({
    description: 'Clase o socio no encontrado (un SOCIO que manda el socioId de otro recibe este 404)',
    content: PROBLEM_JSON,
  })
  @ApiConflictResponse({
    description:
      'La clase alcanzó su capacidad máxima, el socio ya tiene una reserva confirmada activa para esa clase, ' +
      'la reserva se intentó fuera de la ventana de 48 hs previas al inicio, o la clase ya comenzó o finalizó.',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  async crear(
    @Body() dto: ReservaClaseIn,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservaClaseOut> {
    const reserva = await this.acceso.crearReserva(req.user, dto);
    res.setHeader('Location', `/api/v1/reservas-clases/${reserva.id}`);
    return reserva;
  }

  @Get('reservas-clases/:reservaClaseId')
  @ApiOperation({
    operationId: 'obtenerReservaClase',
    summary: 'Obtener reserva de cupo por id',
  })
  @ApiParam({ name: 'reservaClaseId', type: 'integer', description: 'ID de la reserva', example: 10 })
  @ApiOkResponse({ description: 'Detalle de la reserva', type: ReservaClaseOut })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada (o ajena, para un SOCIO)', content: PROBLEM_JSON })
  obtener(
    @Param('reservaClaseId', ParseIntPipe) reservaClaseId: number,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaClaseOut> {
    return this.acceso.obtenerReserva(req.user, reservaClaseId);
  }

  @Post('reservas-clases/:reservaClaseId/cancelaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'cancelarReservaClase',
    summary: 'Cancelar un cupo de clase (RF-07)',
  })
  @ApiParam({
    name: 'reservaClaseId',
    type: 'integer',
    description: 'ID de la reserva a cancelar',
    example: 10,
  })
  @ApiNoContentResponse({
    description:
      'Reserva cancelada y cupo liberado para la lista de espera. Con menos de 2 hs de ' +
      'anticipación se cobró la penalidad (RF-07) antes de liberar el cupo.',
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Reserva no encontrada (o ajena, para un SOCIO)', content: PROBLEM_JSON })
  // Con menos de 2 hs se cobra la penalidad (RF-07): si la pasarela la rechaza, la
  // cancelación no se aplica (la reserva sigue CONFIRMADA) y responde 402.
  @ApiPaymentRequiredResponse({
    description: 'La pasarela rechazó la penalidad por cancelación tardía (RF-07)',
    content: PROBLEM_JSON,
  })
  @ApiConflictResponse({
    description: 'La clase ya comenzó (estado efectivo CUMPLIDA): la reserva no puede cancelarse',
    content: PROBLEM_JSON,
  })
  cancelar(
    @Param('reservaClaseId', ParseIntPipe) reservaClaseId: number,
    @Req() req: RequestConUsuario,
  ): Promise<void> {
    return this.acceso.cancelarReserva(req.user, reservaClaseId);
  }

  @Get('reservas-clases')
  @ApiOperation({
    operationId: 'listarReservasClase',
    summary: 'Listado de reservas de clase con filtros',
  })
  @ApiOkResponse({
    description: 'Listado de reservas de clases',
    type: ListaReservasClaseDto,
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(
    @Query() query: ListarReservasClaseQueryDto,
    @Req() req: RequestConUsuario,
  ): Promise<ListaReservasClaseDto> {
    return this.acceso.listarReservas(req.user, query);
  }
}
