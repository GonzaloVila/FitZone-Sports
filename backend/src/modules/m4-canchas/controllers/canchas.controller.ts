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
import { ProblemDetailsDto } from '../../../commons/swagger/problem-details.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { CanchaOutDto } from '../dtos/cancha-out.dto';
import { CrearCanchaDto } from '../dtos/crear-cancha.dto';
import { ListarCanchasQueryDto } from '../dtos/listar-canchas-query.dto';
import { ModificarCanchaDto } from '../dtos/modificar-cancha.dto';
import { CanchasService } from '../services/canchas.service';

// Dos raíces de ruta distintas (contrato): /sedes/{sedeId}/canchas para
// alta/listado, /canchas/{canchaId} para el resto. @Controller() sin prefijo
// de clase y ruta completa por método (igual que un @Controller('sedes') más
// un @Controller('canchas') fusionados en una sola clase).
@ApiTags('canchas')
@ApiExtraModels(ProblemDetailsDto)
@Controller()
export class CanchasController {
  constructor(private readonly canchasService: CanchasService) {}

  @Get('sedes/:sedeId/canchas')
  @ApiOperation({ operationId: 'listarCanchas', summary: 'Listado de canchas de una sede (RF-12)' })
  @ApiParam({ name: 'sedeId', type: Number, description: 'ID numérico de la sede', example: 1 })
  @ApiOkResponse({ description: 'Listado de canchas', type: [CanchaOutDto] })
  @ApiUnprocessableEntityResponse({ description: 'Parámetros de filtro/paginación inválidos', content: PROBLEM_JSON })
  listar(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Query() query: ListarCanchasQueryDto,
  ): Promise<CanchaOutDto[]> {
    return this.canchasService.listar(sedeId, {
      estado: query.estado,
      page: query.page ?? 1,
      perPage: query.per_page ?? 20,
    });
  }

  @Post('sedes/:sedeId/canchas')
  @ApiOperation({ operationId: 'crearCancha', summary: 'Alta de cancha en una sede' })
  @ApiParam({ name: 'sedeId', type: Number, description: 'ID numérico de la sede', example: 1 })
  @ApiCreatedResponse({
    description: 'Cancha creada',
    type: CanchaOutDto,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/canchas/1' } },
    },
  })
  @ApiNotFoundResponse({ description: 'Sede inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() dto: CrearCanchaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CanchaOutDto> {
    const cancha = await this.canchasService.crear(sedeId, dto);
    res.setHeader('Location', `/api/v1/canchas/${cancha.id}`);
    return cancha;
  }

  @Get('canchas/:canchaId')
  @ApiOperation({ operationId: 'obtenerCancha', summary: 'Cancha por id' })
  @ApiParam({ name: 'canchaId', type: Number, description: 'ID numérico de la cancha', example: 1 })
  @ApiOkResponse({ description: 'Cancha encontrada', type: CanchaOutDto })
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  obtener(@Param('canchaId', ParseIntPipe) canchaId: number): Promise<CanchaOutDto> {
    return this.canchasService.obtener(canchaId);
  }

  @Patch('canchas/:canchaId')
  @ApiOperation({ operationId: 'modificarCancha', summary: 'Modifica costo por hora y/o estado de una cancha' })
  @ApiParam({ name: 'canchaId', type: Number, description: 'ID numérico de la cancha', example: 1 })
  @ApiOkResponse({ description: 'Cancha actualizada', type: CanchaOutDto })
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  modificar(
    @Param('canchaId', ParseIntPipe) canchaId: number,
    @Body() dto: ModificarCanchaDto,
  ): Promise<CanchaOutDto> {
    return this.canchasService.actualizar(canchaId, dto);
  }
}
