import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import { MembresiaOut } from '../dtos/membresia-out.dto';
import { MembresiaPatch } from '../dtos/membresia-patch.dto';
import { MembresiasService } from '../services/membresias.service';

@ApiTags('membresias')
@ApiExtraModels(Problem)
@Controller('socios/:socioId/membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Get()
  @ApiOperation({
    operationId: 'obtenerMembresia',
    summary: 'Membresía actual del socio',
  })
  @ApiParam({ name: 'socioId', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía vigente del socio', type: MembresiaOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  obtener(
    @Param('socioId', ParseIntPipe) socioId: number,
  ): Promise<MembresiaOut> {
    return this.membresiasService.obtenerPorSocioId(socioId);
  }

  @Patch()
  @ApiOperation({
    operationId: 'modificarMembresia',
    summary: 'Cambiar plan o configuración de la membresía',
    // La prosa vive acá y en el contrato, idéntica, a propósito: el entregable sale
    // de /docs-json, así que si la regla solo estuviera en el YAML los compañeros
    // leerían de una versión del contrato que el backend no publica. El comparador
    // local no mira `description` (solo operationId, summary, tags, params, body y
    // responses), pero eso no es excusa para que las dos copias diverjan.
    description:
      'Cambio de plan, renovación automática y/o estado sobre la misma fila (1:1, sin historial). ' +
      'Frenar la renovación = renueva_automatica:false; suspender = estado:SUSPENDIDA. ' +
      'Mandar `plan` abre un período nuevo desde HOY: fecha_inicio y fecha_fin se recalculan ' +
      'juntas con la duración del plan enviado, así que la membresía queda vigente desde la fecha ' +
      'del PATCH hasta un plan después. Los días que quedaban del período anterior no se ' +
      'trasladan. Sin `plan` en el body, ninguna de las dos fechas se toca.',
  })
  @ApiParam({ name: 'socioId', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía actualizada', type: MembresiaOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: MembresiaPatch,
  ): Promise<MembresiaOut> {
    return this.membresiasService.modificar(socioId, dto);
  }
}
