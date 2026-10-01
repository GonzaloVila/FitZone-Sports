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
import { ListarCanchasQueryDto } from '../dtos/listar-canchas-query.dto';
import { CanchasService } from '../services/canchas.service';

// Dos raíces de ruta distintas (contrato): /sedes/{sede_id}/canchas para
// alta/listado, /canchas/{cancha_id} para el resto. @Controller() sin prefijo
// de clase y ruta completa por método (igual que un @Controller('sedes') más
// un @Controller('canchas') fusionados en una sola clase).
@ApiTags('canchas')
@ApiExtraModels(Problem)
@Controller()
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}

  @Get('sedes/:sede_id/canchas')
  @ApiOperation({ operationId: 'listarCanchas', summary: 'Listado de canchas de una sede (RF-12)' })
  @ApiParam({ name: 'sede_id', type: 'integer', description: 'ID numérico de la sede', example: 1 })
  @ApiOkResponse({ description: 'Listado de canchas', type: [CanchaOut] })
  @ApiUnprocessableEntityResponse({ description: 'Parámetros de filtro/paginación inválidos', content: PROBLEM_JSON })
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
  @ApiOperation({ operationId: 'crearCancha', summary: 'Alta de cancha en una sede' })
  @ApiParam({ name: 'sede_id', type: 'integer', description: 'ID numérico de la sede', example: 1 })
  @ApiCreatedResponse({
    description: 'Cancha creada',
    type: CanchaOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/canchas/1' } },
    },
  })
  @ApiNotFoundResponse({ description: 'Sede inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Param('sede_id', ParseIntPipe) sedeId: number,
    @Body() dto: CanchaIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CanchaOut> {
    const cancha = await this.canchasService.crear(sedeId, dto);
    res.setHeader('Location', `/api/v1/canchas/${cancha.id}`);
    return cancha;
  }

  @Get('canchas/:cancha_id')
  @ApiOperation({ operationId: 'obtenerCancha', summary: 'Cancha por id' })
  @ApiParam({ name: 'cancha_id', type: 'integer', description: 'ID numérico de la cancha', example: 1 })
  @ApiOkResponse({ description: 'Cancha encontrada', type: CanchaOut })
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  obtener(@Param('cancha_id', ParseIntPipe) canchaId: number): Promise<CanchaOut> {
    return this.canchasService.obtener(canchaId);
  }

  @Patch('canchas/:cancha_id')
  @ApiOperation({ operationId: 'modificarCancha', summary: 'Modifica costo por hora y/o estado de una cancha' })
  @ApiParam({ name: 'cancha_id', type: 'integer', description: 'ID numérico de la cancha', example: 1 })
  @ApiOkResponse({ description: 'Cancha actualizada', type: CanchaOut })
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  modificar(
    @Param('cancha_id', ParseIntPipe) canchaId: number,
    @Body() dto: CanchaPatch,
  ): Promise<CanchaOut> {
    return this.canchasService.actualizar(canchaId, dto);
  }
}
