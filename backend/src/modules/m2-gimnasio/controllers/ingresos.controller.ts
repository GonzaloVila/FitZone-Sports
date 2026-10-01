import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import {
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { IngresoIn } from '../dtos/ingreso-in.dto';
import { IngresoOut } from '../dtos/ingreso-out.dto';
import { ListarIngresosQueryDto } from '../dtos/listar-ingresos-query.dto';
import { IngresosService } from '../services/ingresos.service';

@ApiTags('ingresos')
@ApiExtraModels(Problem)
@Controller('ingresos')
export class IngresosController {
  constructor(private readonly ingresosService: IngresosService) {}

  // Declarado antes que @Get(':ingreso_id'): además del orden lógico de lectura,
  // deja explícito que /ingresos no cae en la ruta con parámetro.
  @Get()
  @ApiOperation({ operationId: 'listarIngresos', summary: 'Listado de ingresos a sede con filtros' })
  @ApiOkResponse({ description: 'Listado de ingresos', type: [IngresoOut] })
  @ApiUnprocessableEntityResponse({ description: 'Filtros o paginación inválidos', content: PROBLEM_JSON })
  listar(@Query() query: ListarIngresosQueryDto): Promise<IngresoOut[]> {
    const { page, per_page: perPage, ...filtros } = query;
    return this.ingresosService.listar(filtros, { page: page ?? 1, perPage: perPage ?? 20 });
  }

  @Get(':ingreso_id')
  @ApiOperation({ operationId: 'obtenerIngreso', summary: 'Obtener ingreso por id' })
  @ApiParam({ name: 'ingreso_id', type: 'integer', description: 'ID numérico del ingreso', example: 9 })
  @ApiOkResponse({ description: 'Registro de ingreso', type: IngresoOut })
  @ApiNotFoundResponse({ description: 'Ingreso inexistente', content: PROBLEM_JSON })
  obtener(@Param('ingreso_id', ParseIntPipe) ingresoId: number): Promise<IngresoOut> {
    return this.ingresosService.obtenerIngreso(ingresoId);
  }

  @Post()
  @ApiOperation({ operationId: 'registrarIngreso', summary: 'Registrar ingreso a la sede (RF-04)' })
  @ApiCreatedResponse({
    description: 'Ingreso registrado',
    type: IngresoOut,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/ingresos/9' } },
    },
  })
  @ApiForbiddenResponse({ description: 'Membresía inactiva (RF-04)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Sede inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'RN-01 (acceso duplicado) o aforo lleno (RF-05)', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Body() dto: IngresoIn,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IngresoOut> {
    const ingreso = await this.ingresosService.registrarIngreso(dto);
    res.setHeader('Location', `/api/v1/ingresos/${ingreso.id}`);
    return ingreso;
  }

  @Post(':ingreso_id/egreso')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'registrarEgreso', summary: 'Registrar egreso de la sede (RF-05)' })
  @ApiParam({ name: 'ingreso_id', type: 'integer', description: 'ID numérico del ingreso', example: 9 })
  @ApiNoContentResponse({ description: 'Egreso registrado (sin cuerpo)' })
  @ApiNotFoundResponse({ description: 'Ingreso inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'El ingreso ya fue egresado', content: PROBLEM_JSON })
  registrarEgreso(@Param('ingreso_id', ParseIntPipe) ingresoId: number): Promise<void> {
    return this.ingresosService.registrarEgreso(ingresoId);
  }
}
