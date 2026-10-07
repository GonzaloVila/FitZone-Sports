import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { plainToInstance } from 'class-transformer';
import { EVENTO_SOCIO_ALTA } from '../../../commons/eventos';
import { SocioIn } from '../dtos/socio-in.dto';
import { ListarSociosQueryDto } from '../dtos/listar-socios-query.dto';
import { SocioPatch } from '../dtos/socio-patch.dto';
import { SocioOut } from '../dtos/socio-out.dto';
import { PRECIOS_PLAN } from '../entities/membresia.entity';
import { Socio, SocioActualizable } from '../entities/socio.entity';
import { sinCamposParaModificar, usuarioYaEsSocio } from '../errors/socios.errors';
import { SocioRepository } from '../repositories/socio.repository';
import type { SocioTotp } from '../repositories/socio.repository';
import { UsuarioRepository } from '../repositories/usuario.repository';
import { MembresiasService } from './membresias.service';

@Injectable()
export class SociosService {
  constructor(
    private readonly socios: SocioRepository,
    private readonly usuarios: UsuarioRepository,
    // Para emitir el cobro del alta (RF-02): M1 no importa a M5, solo publica el
    // evento y M5 cobra. `MembresiasService` da el id de la membresía recién creada.
    private readonly membresias: MembresiasService,
    private readonly eventos: EventEmitter2,
  ) {}

  // Lo consumia el `ConsultaSocioAdapter` desde el observer de email de M3.
  // Se queda aca porque el email es dato del socio, no de un puerto aparte.
  async obtenerEmail(socioId: number): Promise<string | null> {
    const socio = await this.socios.buscarPorId(socioId);
    return socio?.email ?? null;
  }

  // Para TotpService (modules/auth): resolver si el socio tiene QR dinamico
  // activo y, de tenerlo, el secreto cifrado para validar un codigo_totp.
  // null = el usuario no es socio (sin fila en Socio).
  async obtenerEstadoTotp(usuarioId: number): Promise<SocioTotp | null> {
    return this.socios.buscarTotpPorUsuarioId(usuarioId);
  }

  // Igual que obtenerEstadoTotp, pero por socio_id (M2 referencia socios ahora).
  async obtenerEstadoTotpPorSocio(socioId: number): Promise<SocioTotp | null> {
    return this.socios.buscarTotpPorSocioId(socioId);
  }

  // Activa (o re-genera) el QR dinamico del socio. Perder el celular se
  // resuelve volviendo a pedir este registro: sobrescribe el secreto
  // anterior y no hay recovery codes (decision del plan).
  async activarTotp(usuarioId: number, secretoCifrado: string): Promise<void> {
    await this.socios.guardarTotpSecreto(usuarioId, secretoCifrado);
  }

  // Para AuthService (login): el JWT de un SOCIO lleva su socio_id, asi la app
  // puede mandarlo en POST /ingresos sin resolverlo aparte. null = el usuario no
  // es socio activo.
  async obtenerSocioIdPorUsuario(usuarioId: number): Promise<number | null> {
    const socio = await this.socios.buscarPorUsuarioId(usuarioId);
    return socio?.id ?? null;
  }


  async crear(dto: SocioIn): Promise<SocioOut> {
    const usuario = await this.usuarios.buscarPorId(dto.usuario_id);
    if (!usuario) {
      throw recursoNoEncontrado('No existe el usuario indicado.');
    }
    if (usuario.rol === 'SOCIO') {
      throw usuarioYaEsSocio(usuario.id);
    }

    // Alta = socio + membresía + rol, todo en una tx (socio.repository).
    const socio = await this.socios.crear({
      usuario_id: dto.usuario_id,
      sede_origen_id: dto.sede_origen_id,
      plan: dto.plan,
    });

    // RF-02: el alta es consecuencia del pago. Después del commit se cobra la
    // membresía inicial; si la pasarela rechaza (el listener de M5 lanza un 402),
    // se revierte el alta con una compensación y no queda nada a medio hacer.
    try {
      const membresia = await this.membresias.obtenerPorSocioId(socio.id);
      await this.eventos.emitAsync(EVENTO_SOCIO_ALTA, {
        socio_id: socio.id,
        membresia_id: membresia.id,
        usuario_id: socio.usuario_id,
        precio: PRECIOS_PLAN[dto.plan],
        plan: dto.plan,
      });
    } catch (error) {
      // Compensación: con baja lógica no se borra, se deja inactivo (activo=false).
      await this.socios.marcarBaja(socio.id);
      throw error;
    }

    return this.aOut(socio);
  }

  async listar(dto: ListarSociosQueryDto): Promise<SocioOut[]> {
    const socios = await this.socios.listar(
      {
        sede_origen_id: dto.sede_origen_id,
        estado_membresia: dto.estado_membresia,
        plan: dto.plan,
        nombre: dto.nombre,
      },
      { page: dto.page ?? 1, perPage: dto.per_page ?? 20 },
    );
    return socios.map((socio) => this.aOut(socio));
  }

  async obtenerPorId(id: number): Promise<SocioOut> {
    const socio = await this.socios.buscarPorId(id);
    if (!socio) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(socio);
  }

  async modificar(id: number, dto: SocioPatch): Promise<SocioOut> {
    const cambios: SocioActualizable = {};
    if (dto.sede_origen_id !== undefined) {
      cambios.sede_origen_id = dto.sede_origen_id;
    }

    // SocioPatch tiene un solo campo y es opcional, asi que con body {} el objeto
    // de cambios queda vacio. Prisma 6 interpreta un update sin campos como un
    // no-op y devuelve la fila sin error: la respuesta era un 200 que decia
    // "actualizado" sin haber actualizado nada. El contrato declara 422 para
    // esta operacion, asi que se corta aca.
    if (Object.keys(cambios).length === 0) {
      throw sinCamposParaModificar();
    }

    const socio = await this.socios.actualizar(id, cambios);
    if (!socio) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(socio);
  }

  async dejarDeSerSocio(id: number): Promise<void> {
    const socio = await this.socios.buscarPorId(id);
    if (!socio) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    await this.socios.marcarBaja(id);
  }

  private aOut(socio: Socio): SocioOut {
    return plainToInstance(SocioOut, socio);
  }
}
