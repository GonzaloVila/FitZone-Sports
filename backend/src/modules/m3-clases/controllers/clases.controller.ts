import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../commons/guards/jwt-auth.guard';
import { Roles } from '../../../commons/guards/roles.decorator';
import { RolesGuard } from '../../../commons/guards/roles.guard';
import { Problem } from '../../../commons/swagger/problem.dto';
import { PROBLEM_JSON } from '../../../commons/swagger/problem-json';
import type { UsuarioAutenticado } from '../../auth/strategies/jwt.strategy';
import { ClaseOut } from '../dtos/clase-out.dto';
import { ClaseIn } from '../dtos/clase-in.dto';
import { EsperaOut } from '../dtos/espera-out.dto';
import { ListarClasesQueryDto } from '../dtos/listar-clases-query.dto';
import { ListarEsperaDeClaseQueryDto } from '../dtos/listar-espera-de-clase-query.dto';
import { ListarReservasDeClaseQueryDto } from '../dtos/listar-reservas-de-clase-query.dto';
import { ReservaClaseOut } from '../dtos/reserva-clase-out.dto';
import { ListaClasesDto } from '../dtos/lista-clases.dto';
import { ListaReservasClaseDto } from '../dtos/lista-reservas-clase.dto';
import { ListaEsperasDto } from '../dtos/lista-esperas.dto';
import { ClasesAccesoService } from '../services/clases-acceso.service';
import { ClasesService } from '../services/clases.service';
import { EsperasClasesService } from '../services/esperas-clases.service';
import { ReservasClasesService } from '../services/reservas-clases.service';

interface RequestConUsuario extends Request {
  user: UsuarioAutenticado;
}

const NO_AUTORIZADO = 'Token inválido, expirado o ausente';
const NO_ES_PERSONAL = 'Rol sin permiso (solo RECEPCION/GERENTE)';
const NO_ES_SOCIO_NI_PERSONAL = 'Rol sin permiso (el EXTERNO no usa clases: solo SOCIO, RECEPCION y GERENTE)';

// Todo el controller exige sesion y el EXTERNO nunca entra a clases (no es socio). El alta es de RECEPCION (solo en su sede,
// lo decide ClasesAccesoService) y GERENTE; las inscriptos son solo del personal; la agenda, el detalle y la cola de espera
// son tambien del SOCIO (la cola completa es un acceso provisorio: el front calcula con ella la posicion del socio).
@ApiTags('clases')
@ApiExtraModels(Problem)
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clases')
export class ClasesController {
  constructor(
    private readonly clasesService: ClasesService,
    private readonly reservasService: ReservasClasesService,
    private readonly esperasService: EsperasClasesService,
    private readonly acceso: ClasesAccesoService,
  ) {}

  @Post()
  @Roles('RECEPCION', 'GERENTE')
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
  @ApiUnprocessableEntityResponse({
    description: 'Datos inválidos (ValidationPipe) o rango horario inválido (horarioInicio no anterior a horarioFin)',
    content: PROBLEM_JSON,
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({
    description: 'Rol sin permiso (solo RECEPCION/GERENTE) o sede que no es la del recepcionista',
    content: PROBLEM_JSON,
  })
  @ApiNotFoundResponse({ description: 'La sede referenciada no existe', content: PROBLEM_JSON })
  @ApiConflictResponse({
    description:
      'El horario de inicio no es una fecha-hora ISO-8601 válida, o la clase quedaría ' +
      'programada en un momento ya pasado.',
    content: PROBLEM_JSON,
  })
  async crear(
    @Body() dto: ClaseIn,
    @Req() req: RequestConUsuario,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClaseOut> {
    const clase = await this.acceso.crearClase(req.user, dto);
    res.setHeader('Location', `/api/v1/clases/${clase.id}`);
    return clase;
  }

  @Get()
  @Roles('SOCIO', 'RECEPCION', 'GERENTE')
  @ApiOperation({
    operationId: 'listarClases',
    summary: 'Listado de clases con filtros',
  })
  @ApiOkResponse({
    description: 'Listado de clases con cupos en tiempo real',
    type: ListaClasesDto,
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  listar(@Query() query: ListarClasesQueryDto): Promise<ListaClasesDto> {
    return this.clasesService.listarClases(query);
  }

  @Get(':claseId')
  @Roles('SOCIO', 'RECEPCION', 'GERENTE')
  @ApiOperation({ operationId: 'obtenerClase', summary: 'Obtener clase por id' })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID numérico de la clase', example: 1 })
  @ApiOkResponse({ description: 'Detalle de la clase y aforo disponible', type: ClaseOut })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  obtener(@Param('claseId', ParseIntPipe) claseId: number): Promise<ClaseOut> {
    return this.clasesService.obtenerClase(claseId);
  }

  // Estas dos operaciones viven acá y no en ReservasClasesController /
  // EsperasClasesController porque el contrato las agrupa bajo el tag `clases`:
  // son vistas de la clase, no del recurso reserva o espera. @ApiTags a nivel de
  // metodo se SUMA al del controller, as que solo asi se puede dejar un solo tag.
  @Get(':claseId/reservas')
  @Roles('RECEPCION', 'GERENTE')
  @ApiOperation({
    operationId: 'listarReservasDeClase',
    summary: 'Listado de reservas de una clase',
  })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID de la clase', example: 1 })
  @ApiOkResponse({
    description: 'Listado de reservas de la clase',
    type: ListaReservasClaseDto,
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_PERSONAL, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  listarReservasDeClase(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Query() query: ListarReservasDeClaseQueryDto,
  ): Promise<ListaReservasClaseDto> {
    return this.reservasService.listarReservasDeClase(claseId, query);
  }

  @Get(':claseId/espera')
  @Roles('SOCIO', 'RECEPCION', 'GERENTE')
  @ApiOperation({
    operationId: 'listarEsperaDeClase',
    summary: 'Listado de la lista de espera de una clase',
  })
  @ApiParam({ name: 'claseId', type: 'integer', description: 'ID de la clase', example: 1 })
  @ApiOkResponse({
    description: 'Listado de solicitudes en lista de espera de la clase',
    type: ListaEsperasDto,
  })
  @ApiUnauthorizedResponse({ description: NO_AUTORIZADO, content: PROBLEM_JSON })
  @ApiForbiddenResponse({ description: NO_ES_SOCIO_NI_PERSONAL, content: PROBLEM_JSON })
  @ApiUnprocessableEntityResponse({ description: 'Datos inválidos (ValidationPipe)', content: PROBLEM_JSON })
  @ApiNotFoundResponse({ description: 'Clase no encontrada', content: PROBLEM_JSON })
  listarEsperaDeClase(
    @Param('claseId', ParseIntPipe) claseId: number,
    @Query() query: ListarEsperaDeClaseQueryDto,
  ): Promise<ListaEsperasDto> {
    return this.esperasService.listarEsperaDeClase(claseId, query);
  }
}
