import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CrearMembresiaDto } from '../dtos/crear-membresia.dto';
import { MembresiaOutDto } from '../dtos/membresia-out.dto';
import { MembresiaPatchDto } from '../dtos/membresia-patch.dto';
import { MembresiasService } from '../services/membresias.service';

@ApiTags('M1 Membresías')
@Controller('socios/:socioId/membresias')
export class MembresiasController {
  constructor(private readonly membresiasService: MembresiasService) {}

  @Post()
  @ApiOperation({
    operationId: 'crearMembresia',
    summary: 'Alta de membresía para un socio',
  })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID del socio' })
  @ApiCreatedResponse({ type: MembresiaOutDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async crear(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: CrearMembresiaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MembresiaOutDto> {
    const membresia = await this.membresiasService.crear(socioId, dto);
    res.setHeader('Location', `/api/v1/socios/${socioId}/membresias`);
    return membresia;
  }

  @Get()
  @ApiOperation({
    operationId: 'obtenerMembresia',
    summary: 'Membresía vigente del socio',
  })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID del socio' })
  @ApiOkResponse({ type: MembresiaOutDto })
  @ApiNotFoundResponse()
  obtener(
    @Param('socioId', ParseIntPipe) socioId: number,
  ): Promise<MembresiaOutDto> {
    return this.membresiasService.obtenerPorSocioId(socioId);
  }

  @Patch()
  @ApiOperation({
    operationId: 'modificarMembresia',
    summary: 'Cambiar plan o configuración de la membresía',
  })
  @ApiParam({ name: 'socioId', type: Number, description: 'ID del socio' })
  @ApiOkResponse({ type: MembresiaOutDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  modificar(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: MembresiaPatchDto,
  ): Promise<MembresiaOutDto> {
    return this.membresiasService.modificar(socioId, dto);
  }
}
