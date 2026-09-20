import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CrearSocioDto } from '../dtos/crear-socio.dto';
import { ModificarSocioDto } from '../dtos/modificar-socio.dto';
import { SocioOutDto } from '../dtos/socio-out.dto';
import { SociosService } from '../services/socios.service';

@ApiTags('M1 Socios')
@Controller('socios')
export class SociosController {
  constructor(private readonly sociosService: SociosService) {}

  @Post()
  @ApiOperation({ operationId: 'crearSocio', summary: 'Alta de socio (RF-02)' })
  @ApiCreatedResponse({ type: SocioOutDto })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async crear(
    @Body() dto: CrearSocioDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SocioOutDto> {
    const socio = await this.sociosService.crear(dto);
    res.setHeader('Location', `/api/v1/socios/${socio.id}`);
    return socio;
  }

  @Get(':socioId')
  @ApiOperation({ operationId: 'obtenerSocio', summary: 'Socio por id' })
  @ApiOkResponse({ type: SocioOutDto })
  @ApiNotFoundResponse()
  obtener(@Param('socioId', ParseIntPipe) socioId: number): Promise<SocioOutDto> {
    return this.sociosService.obtenerPorId(socioId);
  }

  @Patch(':socioId')
  @ApiOperation({ operationId: 'modificarSocio', summary: 'Modifica la sede de origen' })
  @ApiOkResponse({ type: SocioOutDto })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  modificar(
    @Param('socioId', ParseIntPipe) socioId: number,
    @Body() dto: ModificarSocioDto,
  ): Promise<SocioOutDto> {
    return this.sociosService.modificar(socioId, dto);
  }

  @Delete(':socioId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'dejarDeSerSocio', summary: 'Deja de ser socio (usuario vuelve a EXTERNO)' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  eliminar(@Param('socioId', ParseIntPipe) socioId: number): Promise<void> {
    return this.sociosService.dejarDeSerSocio(socioId);
  }
}
