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
import { BuscarCanchasQueryDto } from '../dtos/buscar-canchas-query.dto';
import { CanchaIn } from '../dtos/cancha-in.dto';
import { CanchaOut } from '../dtos/cancha-out.dto';
import { CanchaPatch } from '../dtos/cancha-patch.dto';
import { ConsultarDisponibilidadQueryDto } from '../dtos/consultar-disponibilidad-query.dto';
import { DisponibilidadEntrada } from '../dtos/disponibilidad-entrada.dto';
import { ListarCanchasQueryDto } from '../dtos/listar-canchas-query.dto';
import { ListaCanchasDto } from '../dtos/lista-canchas.dto';
import { ListaDisponibilidadDto } from '../dtos/lista-disponibilidad.dto';
import { CanchasService } from '../services/canchas.service';
import { DisponibilidadService } from '../services/disponibilidad.service';

// Dos raices de ruta distintas en el contrato: /sedes/{sedeId}/canchas para
// el alta y el listado, /canchas/{canchaId} para el resto. El tag es uno solo
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

  @Get('sedes/:sedeId/canchas')
  @ApiOperation({
    operationId: 'listarCanchas',
    summary: 'Listado de canchas de una sede',
    description:
      'Listado paginado de las canchas de la sede (incluye las no operativas, RF-12); ' +
      'opcional filtrar por ?estado= (lista blanca de parametros). Sin ?estado= devuelve ' +
      'todas, incluidas las EN_MANTENIMIENTO.',
  })
  @ApiParam({ name: 'sedeId', type: 'integer', description: 'ID numerico de la sede', example: 3 })
  @ApiOkResponse({ description: 'Listado de canchas', type: ListaCanchasDto })
  @ApiNotFoundResponse({ description: 'La sede no existe', content: PROBLEM_JSON })
  // 422 por query params invalidos: la ValidationPipe global valida el DTO de
  // listado igual que valida los bodies, asi que ?estado=INVALIDA, ?page=0 o
  // ?perPage=101 devuelven 422 aunque antes no se declarara. El contrato lo
  // declara desde el Bloque 4: GET /sedes, GET /ingresos y GET /reservas-canchas
  // ya lo declaraban y este era el unico listado paginado que faltaba.
  @ApiUnprocessableEntityResponse({ description: 'Filtros o paginación inválidos', content: PROBLEM_JSON })
  listar(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Query() query: ListarCanchasQueryDto,
  ): Promise<ListaCanchasDto> {
    return this.canchasService.listar(sedeId, {
      estado: query.estado,
      page: query.page ?? 1,
      perPage: query.perPage ?? 20,
    });
  }

  @Post('sedes/:sedeId/canchas')
  @ApiOperation({
    operationId: 'crearCancha',
    summary: 'Alta de cancha (RF-09)',
    description: 'El Gerente configura el tipo y el costo por hora (por defecto, operativa).',
  })
  @ApiParam({ name: 'sedeId', type: 'integer', description: 'ID numerico de la sede', example: 3 })
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
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() dto: CanchaIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CanchaOut> {
    const cancha = await this.canchasService.crear(sedeId, dto);
    res.setHeader('Location', `/api/v1/sedes/${sedeId}/canchas/${cancha.id}`);
    return cancha;
  }

  // `canchas` (sin parametro) y `canchas/:canchaId` no chocan: Express compara la
  // ruta completa, y ':canchaId' exige un segmento mas.
  @Get('canchas')
  @ApiOperation({
    operationId: 'buscarCanchas',
    summary: 'Listado de canchas de todas las sedes',
    description:
      'Listado paginado de las canchas de TODAS las sedes (incluye las no operativas, RF-12); ' +
      'opcional filtrar por sede, tipo y estado (lista blanca de parametros). Sin filtros devuelve ' +
      'todas las canchas de la cadena. Orden estable por sede y luego por id (`sede_id asc, id asc`). ' +
      'Como en GET /ingresos y GET /socios, un `sedeId` bien formado pero inexistente no es un error: ' +
      'responde 200 con la lista vacia (`items: []`, `total: 0`); el 404 de una sede inexistente es ' +
      'propio de GET /sedes/{sedeId}/canchas, donde la sede es parte de la ruta.',
  })
  @ApiOkResponse({ description: 'Listado de canchas', type: ListaCanchasDto })
  @ApiUnprocessableEntityResponse({ description: 'Filtros o paginación inválidos', content: PROBLEM_JSON })
  buscar(@Query() query: BuscarCanchasQueryDto): Promise<ListaCanchasDto> {
    return this.canchasService.buscar({
      sedeId: query.sedeId,
      tipo: query.tipo,
      estado: query.estado,
      page: query.page ?? 1,
      perPage: query.perPage ?? 20,
    });
  }

  @Get('canchas/:canchaId')
  @ApiOperation({ operationId: 'obtenerCancha', summary: 'Obtener cancha por id' })
  @ApiParam({
    name: 'canchaId',
    type: 'integer',
    description: 'ID numerico de la cancha',
    example: 6,
  })
  @ApiOkResponse({ description: 'Cancha', type: CanchaOut })
  @ApiNotFoundResponse({ description: 'La cancha no existe', content: PROBLEM_JSON })
  obtener(@Param('canchaId', ParseIntPipe) canchaId: number): Promise<CanchaOut> {
    return this.canchasService.obtener(canchaId);
  }

  @Patch('canchas/:canchaId')
  @ApiOperation({
    operationId: 'modificarCancha',
    summary: 'Modificar parcialmente una cancha',
    description:
      'Actualiza costo_por_hora (RF-09) y/o estado. Pasar a EN_MANTENIMIENTO no borra las ' +
      'reservas ya tomadas (RF-12): inhabilitar el futuro no toca el historico.',
  })
  @ApiParam({
    name: 'canchaId',
    type: 'integer',
    description: 'ID numerico de la cancha',
    example: 6,
  })
  @ApiOkResponse({ description: 'Cancha actualizada', type: CanchaOut })
  @ApiNotFoundResponse({ description: 'La cancha no existe', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos invalidos', content: PROBLEM_JSON })
  modificar(
    @Param('canchaId', ParseIntPipe) canchaId: number,
    @Body() dto: CanchaPatch,
  ): Promise<CanchaOut> {
    return this.canchasService.actualizar(canchaId, dto);
  }

  @Get('canchas/:canchaId/disponibilidad')
  @ApiOperation({ operationId: 'consultarDisponibilidad', summary: 'Disponibilidad de turnos de una cancha' })
  @ApiParam({ name: 'canchaId', type: 'integer', description: 'ID numérico de la cancha', example: 1 })
  @ApiOkResponse({ description: 'Tramos horarios del día con su disponibilidad', type: ListaDisponibilidadDto })
  @ApiNotFoundResponse({ description: 'Cancha inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Fecha o paginación inválidas', content: PROBLEM_JSON })
  consultarDisponibilidad(
    @Param('canchaId', ParseIntPipe) canchaId: number,
    @Query() query: ConsultarDisponibilidadQueryDto,
  ): Promise<ListaDisponibilidadDto> {
    return this.disponibilidadService.consultar(canchaId, query.fecha, {
      page: query.page ?? 1,
      perPage: query.perPage ?? 20,
    });
  }
}
