import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
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
import { CanchaIn } from '../dtos/cancha-in.dto';
import { CanchaOut } from '../dtos/cancha-out.dto';
import { CanchaPatch } from '../dtos/cancha-patch.dto';
import { ConsultarDisponibilidadQueryDto } from '../dtos/consultar-disponibilidad-query.dto';
import { DisponibilidadEntrada } from '../dtos/disponibilidad-entrada.dto';
import { ListarCanchasQueryDto } from '../dtos/listar-canchas-query.dto';
import { CanchasService } from '../services/canchas.service';
import { DisponibilidadService } from '../services/disponibilidad.service';

// Dos raices de ruta distintas en el contrato: /sedes/{sede_id}/canchas para
// el alta y el listado, /canchas/{cancha_id} para el resto. El tag es uno solo
// ("canchas") para las cinco operaciones, asi que una sola clase con
// @Controller() sin prefijo y la ruta completa por metodo emite el tag correcto.
@ApiTags('canchas')
@ApiExtraModels(Problem)
@Controller()
export class CanchasController {
  constructor(
    private readonly canchasService: CanchasService,
    private readonly disponibilidadService: DisponibilidadService,
  ) {}

  @Get('sedes/:sede_id/canchas')
  @ApiOperation({
    operationId: 'listarCanchas',
    summary: 'Listado de canchas de una sede',
    description:
      'Listado paginado de las canchas de la sede (incluye las no operativas, RF-12); ' +
      'opcional filtrar por ?estado= (lista blanca de parametros). Sin ?estado= devuelve ' +
      'todas, incluidas las EN_MANTENIMIENTO.',
  })
  @ApiParam({ name: 'sede_id', type: 'integer', description: 'ID numerico de la sede', example: 3 })
  @ApiOkResponse({ description: 'Listado de canchas', type: [CanchaOut] })
  // Sin 422: el contrato declara solo 200 y 404 en este listado. El plan lo pedia
  // y el contrato manda sobre el plan (mismo criterio que en el Bloque 1).
  @ApiNotFoundResponse({ description: 'La sede no existe', content: PROBLEM_JSON })
  listar(
    @Param('sede_id', ParseIntPipe) sedeId: number,
    @Query() query: ListarCanchasQueryDto,
  ): Promise<CanchaOut[]> {
    return this.canchasService.listar(sedeId, {
      estado: query.estado,
      page: query.page ?? 1,
      perPage: query.per_page ?? 20,
    });
  }

  @Post('sedes/:sede_id/canchas')
  @ApiOperation({
    operationId: 'crearCancha',
    summary: 'Alta de cancha (RF-09)',
    description: 'El Gerente configura el tipo y el costo por hora (por defecto, operativa).',
  })
  @ApiParam({ name: 'sede_id', type: 'integer', description: 'ID numerico de la sede', example: 3 })
  @ApiCreatedResponse({
    description: 'Cancha creada',
    type: CanchaOut,
    headers: {
      Location: {
        description: 'URL del recurso creado',
        schema: { type: 'string', example: '/api/v1/sedes/3/canchas/6' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'La sede no existe', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos invalidos', content: PROBLEM_JSON })
  async crear(
    @Param('sede_id', ParseIntPipe) sedeId: number,
    @Body() dto: CanchaIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CanchaOut> {
    const cancha = await this.canchasService.crear(sedeId, dto);
    res.setHeader('Location', `/api/v1/sedes/${sedeId}/canchas/${cancha.id}`);
    return cancha;
  }

  @Get('canchas/:cancha_id')
  @ApiOperation({ operationId: 'obtenerCancha', summary: 'Obtener cancha por id' })
  @ApiParam({
    name: 'cancha_id',
    type: 'integer',
    description: 'ID numerico de la cancha',
    example: 6,
  })
  @ApiOkResponse({ description: 'Cancha', type: CanchaOut })
  @ApiNotFoundResponse({ description: 'La cancha no existe', content: PROBLEM_JSON })
  obtener(@Param('cancha_id', ParseIntPipe) canchaId: number): Promise<CanchaOut> {
    return this.canchasService.obtener(canchaId);
  }

  @Patch('canchas/:cancha_id')
  @ApiOperation({
    operationId: 'modificarCancha',
    summary: 'Modificar parcialmente una cancha',
    description:
      'Actualiza costo_por_hora (RF-09) y/o estado. Pasar a EN_MANTENIMIENTO no borra las ' +
      'reservas ya tomadas (RF-12): inhabilitar el futuro no toca el historico.',
  })
  @ApiParam({
    name: 'cancha_id',
    type: 'integer',
    description: 'ID numerico de la cancha',
    example: 6,
  })
  @ApiOkResponse({ description: 'Cancha actualizada', type: CanchaOut })
  @ApiNotFoundResponse({ description: 'La cancha no existe', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos invalidos', content: PROBLEM_JSON })
  modificar(
    @Param('cancha_id', ParseIntPipe) canchaId: number,
    @Body() dto: CanchaPatch,
  ): Promise<CanchaOut> {
    return this.canchasService.actualizar(canchaId, dto);
  }

  @Get('canchas/:cancha_id/disponibilidad')
  @ApiOperation({ operationId: 'consultarDisponibilidad', summary: 'Disponibilidad de turnos de una cancha' })
  @ApiParam({ name: 'cancha_id', type: 'integer', description: 'ID numérico de la cancha', example: 1 })
  @ApiOkResponse({ description: 'Tramos horarios del día con su disponibilidad', type: [DisponibilidadEntrada] })
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Fecha o paginación inválidas', content: PROBLEM_JSON })
  consultarDisponibilidad(
    @Param('cancha_id', ParseIntPipe) canchaId: number,
    @Query() query: ConsultarDisponibilidadQueryDto,
  ): Promise<DisponibilidadEntrada[]> {
    return this.disponibilidadService.consultar(canchaId, query.fecha, {
      page: query.page ?? 1,
      perPage: query.per_page ?? 20,
    });
  }
}
