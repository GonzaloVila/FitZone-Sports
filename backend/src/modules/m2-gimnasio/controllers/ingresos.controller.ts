import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Res } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ProblemDetailsDto } from '../../../commons/swagger/problem-details.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { IngresoInDto } from '../dtos/ingreso-in.dto';
import { IngresoOutDto } from '../dtos/ingreso-out.dto';
import { IngresosService } from '../services/ingresos.service';

@ApiTags('M2 Ingresos')
@ApiExtraModels(ProblemDetailsDto)
@Controller('ingresos')
export class IngresosController {
  constructor(private readonly ingresosService: IngresosService) {}

  @Post()
  @ApiOperation({ operationId: 'registrarIngreso', summary: 'Registrar ingreso a la sede (RF-04)' })
  @ApiCreatedResponse({
    description: 'Ingreso registrado',
    type: IngresoOutDto,
    headers: {
      Location: { description: 'URL del recurso creado', schema: { type: 'string', example: '/api/v1/ingresos/9' } },
    },
  })
  @ApiForbiddenResponse({ description: 'Membresía inactiva (RF-04)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Sede inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'RN-01 (acceso duplicado) o aforo lleno (RF-05)', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos', content: PROBLEM_JSON })
  async crear(
    @Body() dto: IngresoInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IngresoOutDto> {
    const ingreso = await this.ingresosService.registrarIngreso(dto);
    res.setHeader('Location', `/api/v1/ingresos/${ingreso.id}`);
    return ingreso;
  }

  @Post(':ingresoId/egreso')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'registrarEgreso', summary: 'Registrar egreso de la sede (RF-05)' })
  @ApiParam({ name: 'ingresoId', type: Number, description: 'ID numérico del ingreso', example: 9 })
  @ApiNoContentResponse({ description: 'Egreso registrado (sin cuerpo)' })
  @ApiNotFoundResponse({ description: 'Ingreso inexistente', content: PROBLEM_JSON })
  @ApiConflictResponse({ description: 'El ingreso ya fue egresado', content: PROBLEM_JSON })
  registrarEgreso(@Param('ingresoId', ParseIntPipe) ingresoId: number): Promise<void> {
    return this.ingresosService.registrarEgreso(ingresoId);
  }
}
