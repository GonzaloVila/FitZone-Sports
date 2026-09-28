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
import { ProblemDetailsDto } from '../../../commons/swagger/problem-details.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { ClaseOutDto } from '../dtos/clase-out.dto';
import { CrearClaseDto } from '../dtos/crear-clase.dto';
import { ListarClasesQueryDto } from '../dtos/listar-clases-query.dto';
import { ClasesService } from '../services/clases.service';

@ApiTags('clases')
@ApiExtraModels(ProblemDetailsDto)
@Controller('clases')
export class ClasesController {
  constructor(private readonly clasesService: ClasesService) {}

  @Post()
  @ApiOperation({ operationId: 'crearClase', summary: 'Crear nueva clase grupal (RF-06)' })
  @ApiCreatedResponse({
    description: 'Clase programada y publicada exitosamente',
    type: ClaseOutDto,
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
    @Body() dto: CrearClaseDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClaseOutDto> {
    const clase = await this.clasesService.crearClase(dto);
    res.setHeader('Location', `/api/v1/clases/${clase.id}`);
    return clase;
  }

  @Get()
  @ApiOperation({
    operationId: 'listarClases',
    summary: 'Listar clases grupales con cálculo de aforo disponible (RF-06)',
  })
  @ApiOkResponse({
    description: 'Listado de clases con cupos en tiempo real',
    type: [ClaseOutDto],
  })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() query: ListarClasesQueryDto): Promise<ClaseOutDto[]> {
    return this.clasesService.listarClases(query);
  }

  @Get(':clase_id')
  @ApiOperation({ operationId: 'obtenerClase', summary: 'Consultar detalle y ocupación de clase (RF-06)' })
  @ApiParam({ name: 'clase_id', type: Number, description: 'ID numérico de la clase', example: 1 })
  @ApiOkResponse({ description: 'Detalle de la clase y aforo disponible', type: ClaseOutDto })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  obtener(@Param('clase_id', ParseIntPipe) clase_id: number): Promise<ClaseOutDto> {
    return this.clasesService.obtenerClase(clase_id);
  }
}
