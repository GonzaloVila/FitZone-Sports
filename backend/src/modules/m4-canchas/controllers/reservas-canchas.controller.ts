import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { ListarReservasCanchasQueryDto } from '../dtos/listar-reservas-canchas-query.dto';
import { ReservaCanchaIn } from '../dtos/reserva-cancha-in.dto';
import { ReservaCanchaOut } from '../dtos/reserva-cancha-out.dto';
import { ReservasCanchasService } from '../services/reservas-canchas.service';

@ApiTags('reservas-canchas')
@ApiExtraModels(Problem)
@Controller('reservas-canchas')
export class ReservasCanchasController {
  constructor(private readonly reservasCanchasService: ReservasCanchasService) {}

  // Declarado antes que @Get(':reserva_cancha_id'): /reservas-canchas no cae en
  // la ruta con parámetro.
  @Get()
  @ApiOperation({ operationId: 'listarReservasCancha', summary: 'Listado de reservas de cancha con filtros' })
  @ApiOkResponse({ description: 'Listado de reservas de cancha', type: [ReservaCanchaOut] })
  @ApiUnprocessableEntityResponse({ description: 'Filtros o paginación inválidos', content: PROBLEM_JSON })
  listar(@Query() query: ListarReservasCanchasQueryDto): Promise<ReservaCanchaOut[]> {
    return this.reservasCanchasService.listar({
      canchaId: query.cancha_id,
      usuarioId: query.usuario_id,
      estado: query.estado,
      fecha: query.fecha,
      page: query.page ?? 1,
      perPage: query.per_page ?? 20,
    });
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
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description: 'Turno ocupado (RN-02) o cancha en mantenimiento (RF-12)',
    content: PROBLEM_JSON,
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Body() dto: ReservaCanchaIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReservaCanchaOut> {
    const reserva = await this.reservasCanchasService.crear(dto);
    res.setHeader('Location', `/api/v1/reservas-canchas/${reserva.id}`);
    return reserva;
  }

  @Get(':reserva_cancha_id')
  @ApiOperation({ operationId: 'obtenerReservaCancha', summary: 'Obtener reserva de cancha por id' })
  @ApiParam({ name: 'reserva_cancha_id', type: 'integer', description: 'ID numérico de la reserva', example: 7 })
  @ApiOkResponse({ description: 'Reserva de cancha', type: ReservaCanchaOut })
  @ApiNotFoundResponse({ description: 'Reserva inexistente', content: PROBLEM_JSON })
  obtener(@Param('reserva_cancha_id', ParseIntPipe) reservaCanchaId: number): Promise<ReservaCanchaOut> {
    return this.reservasCanchasService.obtener(reservaCanchaId);
  }

  @Post(':reserva_cancha_id/cancelaciones')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'cancelarReservaCancha', summary: 'Cancelar una reserva' })
  @ApiParam({ name: 'reserva_cancha_id', type: 'integer', description: 'ID numérico de la reserva', example: 7 })
  @ApiNoContentResponse({ description: 'Reserva cancelada (sin cuerpo)' })
  @ApiNotFoundResponse({ description: 'Reserva inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'La reserva ya estaba cancelada', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  cancelar(@Param('reserva_cancha_id', ParseIntPipe) reservaCanchaId: number): Promise<void> {
    return this.reservasCanchasService.cancelar(reservaCanchaId);
  }
}
