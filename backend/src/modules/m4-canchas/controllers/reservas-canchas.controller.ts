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
import { JwtAuthGuard } from '../../../commons/guards/jwt-auth.guard';
import { RolesGuard } from '../../../commons/guards/roles.guard';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { ListarReservasCanchasQueryDto } from '../dtos/listar-reservas-canchas-query.dto';
import { ReservaCanchaIn } from '../dtos/reserva-cancha-in.dto';
import { ReservaCanchaOut } from '../dtos/reserva-cancha-out.dto';
import { ListaReservasCanchaDto } from '../dtos/lista-reservas-cancha.dto';
import { ReservasCanchasAccesoService } from '../services/reservas-canchas-acceso.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';

// Todo el controller exige sesion y cualquier rol entra (sin @Roles). Lo que ve o hace cada uno lo decide
// ReservasCanchasAccesoService: SOCIO y EXTERNO solo lo propio (lo ajeno responde 404), RECEPCION y GERENTE todo.
@ApiTags('reservas-canchas')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservas-canchas')
export class ReservasCanchasController {
  constructor(private readonly acceso: ReservasCanchasAccesoService) {}

  // Declarado antes que @Get(':reservaCanchaId'): /reservas-canchas no cae en
  // la ruta con parámetro.
  @Get()
  @ApiOperation({ operationId: 'listarReservasCancha', summary: 'Listado de reservas de cancha con filtros' })
  @ApiOkResponse({ description: 'Listado de reservas de cancha', type: ListaReservasCanchaDto })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Filtros o paginación inválidos', content: PROBLEM_JSON })
  listar(
    @Query() query: ListarReservasCanchasQueryDto,
    @Req() req: RequestConUsuario,
  ): Promise<ListaReservasCanchaDto> {
    return this.acceso.listar(req.user, query);
  }

  @Post()
  @ApiOperation({ operationId: 'crearReservaCancha', summary: 'Reservar un turno de cancha (RF-10, RN-02)' })
  @ApiCreatedResponse({
    description: 'Reserva creada',
    type: ReservaCanchaOut,
    headers: {
      Location: {
        description: 'URL del recurso creado',
        schema: { type: 'string', example: '/api/v1/reservas-canchas/7' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiNotFoundResponse({
    description: 'Cancha inexistente, o `usuario_id` de otro usuario (para SOCIO y EXTERNO)',
    content: PROBLEM_JSON,
  })
  @ApiConflictResponse({
    description: 'Turno ocupado (RN-02) o cancha en mantenimiento (RF-12)',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Body() dto: ReservaCanchaIn,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservaCanchaOut> {
    const reserva = await this.acceso.crear(req.user, dto);
    res.setHeader('Location', `/api/v1/reservas-canchas/${reserva.id}`);
    return reserva;
  }

  @Get(':reservaCanchaId')
  @ApiOperation({ operationId: 'obtenerReservaCancha', summary: 'Obtener reserva de cancha por id' })
  @ApiParam({ name: 'reservaCanchaId', type: 'integer', description: 'ID numérico de la reserva', example: 7 })
  @ApiOkResponse({ description: 'Reserva de cancha', type: ReservaCanchaOut })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Reserva inexistente (o ajena, para SOCIO y EXTERNO)', content: PROBLEM_JSON })
  obtener(
    @Param('reservaCanchaId', ParseIntPipe) reservaCanchaId: number,
    @Req() req: RequestConUsuario,
  ): Promise<ReservaCanchaOut> {
    return this.acceso.obtener(req.user, reservaCanchaId);
  }

  @Post(':reservaCanchaId/cancelaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'cancelarReservaCancha', summary: 'Cancelar una reserva' })
  @ApiParam({ name: 'reservaCanchaId', type: 'integer', description: 'ID numérico de la reserva', example: 7 })
  @ApiNoContentResponse({ description: 'Reserva cancelada (sin cuerpo)' })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Reserva inexistente (o ajena, para SOCIO y EXTERNO)', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'La reserva ya estaba cancelada o su turno ya pasó', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  cancelar(
    @Param('reservaCanchaId', ParseIntPipe) reservaCanchaId: number,
    @Req() req: RequestConUsuario,
  ): Promise<void> {
    return this.acceso.cancelar(req.user, reservaCanchaId);
  }
}
