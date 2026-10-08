import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiConflictResponse,
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
import { ClaseOut } from '../dtos/clase-out.dto';
import { ClaseIn } from '../dtos/clase-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarClasesQueryDto } from '../dtos/listar-clases-query.dto';
import { ListarEsperaDeClaseQueryDto } from '../dtos/listar-espera-de-clase-query.dto';
import { ListarReservasDeClaseQueryDto } from '../dtos/listar-reservas-de-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { ClasesService } from '../services/clases.service';
import { EsperasClasesService } from '../services/esperas-clases.service';
import { ReservasClasesService } from '../services/reservas-clases.service';

@ApiTags('clases')
@ApiExtraModels(Problem)
@Controller('clases')
export class ClasesController {
  constructor(
    private readonly clasesService: ClasesService,
    private readonly reservasService: ReservasClasesService,
    private readonly esperasService: EsperasClasesService,
  ) {}

  @Post()
  @ApiOperation({ operationId: 'crearClase', summary: 'Alta de clase (RF-06)' })
  @ApiCreatedResponse({
    description: 'Clase programada y publicada exitosamente',
    type: ClaseOut,
    headers: {
      Location: {
        description: 'URL de acceso a la clase creada',
        schema: { type: 'string', example: '/api/v1/clases/5' },
      },
    },
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'La sede referenciada no existe', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description:
      'El horario enviado no es una fecha-hora ISO-8601 válida, o la clase quedaría ' +
      'programada en un momento ya pasado.',
    content: PROBLEM_JSON,
  })
  async crear(
    @Body() dto: ClaseIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClaseOut> {
    const clase = await this.clasesService.crearClase(dto);
    res.setHeader('Location', `/api/v1/clases/${clase.id}`);
    return clase;
  }

  @Get()
  @ApiOperation({
    operationId: 'listarClases',
    summary: 'Listado de clases con filtros',
  })
  @ApiOkResponse({
    description: 'Listado de clases con cupos en tiempo real',
    type: [ClaseOut],
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() query: ListarClasesQueryDto): Promise<ClaseOut[]> {
    return this.clasesService.listarClases(query);
  }

  @Get(':claseId')
  @ApiOperation({ operationId: 'obtenerClase', summary: 'Obtener clase por id' })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID numérico de la clase', example: 1 })
  @ApiOkResponse({ description: 'Detalle de la clase y aforo disponible', type: ClaseOut })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  obtener(@Param('claseId', ParseIntPipe) claseId: number): Promise<ClaseOut> {
    return this.clasesService.obtenerClase(claseId);
  }

  // Estas dos operaciones viven acá y no en ReservasClasesController /
  // EsperasClasesController porque el contrato las agrupa bajo el tag `clases`:
  // son vistas de la clase, no del recurso reserva o espera. @ApiTags a nivel de
  // metodo se SUMA al del controller, as que solo asi se puede dejar un solo tag.
  @Get(':claseId/reservas')
  @ApiOperation({
    operationId: 'listarReservasDeClase',
    summary: 'Listado de reservas de una clase',
  })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID de la clase', example: 1 })
  @ApiOkResponse({
    description: 'Listado de reservas de la clase',
    type: [ReservaClaseOut],
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  listarReservasDeClase(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Query() query: ListarReservasDeClaseQueryDto,
  ): Promise<ReservaClaseOut[]> {
    return this.reservasService.listarReservasDeClase(claseId, query);
  }

  @Get(':claseId/espera')
  @ApiOperation({
    operationId: 'listarEsperaDeClase',
    summary: 'Listado de la lista de espera de una clase',
  })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID de la clase', example: 1 })
  @ApiOkResponse({
    description: 'Listado de solicitudes en lista de espera de la clase',
    type: [EsperaOut],
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  listarEsperaDeClase(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Query() query: ListarEsperaDeClaseQueryDto,
  ): Promise<EsperaOut[]> {
    return this.esperasService.listarEsperaDeClase(claseId, query);
  }
}
