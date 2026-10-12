import { Controller, Get, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { rangoDelDia } from '../../commons/fechas';
import { JwtAuthGuard } from '../../commons/guards/jwt-auth.guard';
import { Roles } from '../../commons/guards/roles.decorator';
import { RolesGuard } from '../../commons/guards/roles.guard';
import { Problem } from '../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../commons/swagger/problem-json';
import { ReporteIngresosService } from '../m5-pagos/services/reporte-ingresos.service';
import { ListarReporteQueryDto } from './dtos/listar-reporte-query.dto';
import { ReportesService } from './services/reportes.service';

@ApiTags('reportes')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(
    private readonly ingresos: ReporteIngresosService,
    private readonly reportes: ReportesService,
  ) {}

  @Get('pagos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GERENTE')
  @ApiOperation({
    operationId: 'reporteIngresos',
    summary: 'Reporte de ingresos por período (PDF)',
    description:
      'Consolidado en PDF de los pagos APROBADO, agrupado por día local de la sede, sede y ' +
      'tipo de concepto, con total por fila y total general. `desde` y `hasta` son días ' +
      '(YYYY-MM-DD) en hora local y forman un intervalo cerrado; sin ellos es histórico. ' +
      'Solo GERENTE.',
  })
  @ApiOkResponse({
    description: 'Reporte en PDF',
    content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado', content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: 'Acceso prohibido', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Error de validación', content: PROBLEM_JSON })
  async listarReporte(
    @Query() dto: ListarReporteQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // `hasta` es un día inclusivo: se toma el fin de ese día, el `[desde, hasta)` semiabierto.
    const rango = {
      desde: dto.desde !== undefined ? rangoDelDia(dto.desde).desde : undefined,
      hasta: dto.hasta !== undefined ? rangoDelDia(dto.hasta).hasta : undefined,
    };

    const reporte = await this.ingresos.consolidadoPagos(rango);
    const pdf = this.reportes.armarPdf(reporte, rango);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-ingresos.pdf"');
    return new StreamableFile(pdf);
  }
}
