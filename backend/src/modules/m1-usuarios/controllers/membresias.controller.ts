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
@Controller('socios/:socio_id/membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Get()
  @ApiOperation({
    operationId: 'obtenerMembresia',
    summary: 'Membresía actual del socio',
  })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía vigente del socio', type: MembresiaOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  obtener(
    @Param('socio_id', ParseIntPipe) socioId: number,
  ): Promise<MembresiaOut> {
    return this.membresiasService.obtenerPorSocioId(socioId);
  }

  @Patch()
  @ApiOperation({
    operationId: 'modificarMembresia',
    summary: 'Cambiar plan o configuración de la membresía',
  })
  @ApiParam({ name: 'socio_id', type: 'integer', description: 'ID numérico del socio', example: 2 })
  @ApiOkResponse({ description: 'Membresía actualizada', type: MembresiaOut })
  @ApiBadRequestResponse({ description: 'socio_id no numérico o JSON inválido', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Socio inexistente', content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe)',
    content: PROBLEM_JSON,
  })
  modificar(
    @Param('socio_id', ParseIntPipe) socioId: number,
    @Body() dto: MembresiaPatch,
  ): Promise<MembresiaOut> {
    return this.membresiasService.modificar(socioId, dto);
  }
}
