import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recursoNoEncontrado } from '../../../commons/filters/problem.exception';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { UsuarioIn } from '../dtos/usuario-in.dto';
import { ListarUsuariosQueryDto } from '../dtos/listar-usuarios-query.dto';
import { UsuarioPatch } from '../dtos/usuario-patch.dto';
import { UsuarioOut } from '../dtos/usuario-out.dto';
import { Usuario, UsuarioActualizable } from '../entities/usuario.entity';
import { sinCamposParaModificar, usuarioDuplicado } from '../errors/socios.errors';
import {
  recepcionSinSede,
  sedeConRecepcionista,
  sedeInexistente,
  sedeSoloParaRecepcion,
} from '../errors/usuarios.errors';
import { EmpleadoSedeRepository } from '../repositories/empleado-sede.repository';
import { UsuarioRepository } from '../repositories/usuario.repository';

const SALT_ROUNDS = 10;

export interface UsuarioParaAutenticar extends Usuario {
  // null salvo RECEPCION con fila en EmpleadoSede. No confundir con
  // Socio.sedeOrigenId (RF-03): este es la sucursal de trabajo del staff.
  sedeId: number | null;
}

@Injectable()
export class UsuariosService {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly empleadosSede: EmpleadoSedeRepository,
  ) {}

  // Para AuthModule (login). Devuelve el hash de la contraseña a proposito:
  // a diferencia de aOut()/UsuarioOut, este metodo no sale por HTTP y es
  // AuthService el unico que compara el hash. No se exporta UsuarioOut con
  // contrasenia ni se expone este metodo como endpoint.
  async buscarParaAutenticar(email: string): Promise<UsuarioParaAutenticar | null> {
    const usuario = await this.usuarios.buscarPorEmail(email);
    return usuario ? this.conSedeDeTrabajo(usuario) : null;
  }

  // Para AuthModule (refresh): misma forma que buscarParaAutenticar pero por id,
  // asi el access token renovado sale con el rol y la sede actuales y no con los
  // del login. null = el usuario ya no existe.
  async buscarParaAutenticarPorId(id: number): Promise<UsuarioParaAutenticar | null> {
    const usuario = await this.usuarios.buscarPorId(id);
    return usuario ? this.conSedeDeTrabajo(usuario) : null;
  }

  private async conSedeDeTrabajo(usuario: Usuario): Promise<UsuarioParaAutenticar> {
    let sedeId: number | null = null;
    if (usuario.rol === 'RECEPCION') {
      const empleado = await this.empleadosSede.buscarPorUsuarioId(usuario.id);
      sedeId = empleado?.sedeId ?? null;
    }

    return { ...usuario, sedeId };
  }

  async crear(dto: UsuarioIn): Promise<UsuarioOut> {
    // La sede de trabajo solo existe para RECEPCION (EmpleadoSede, A3; ver
    // fitzone.dbml: EXTERNO y GERENTE "viven solo en rol"). Se valida antes de
    // tocar la base para que el 422 no dependa de una consulta.
    const esRecepcion = dto.rol === 'RECEPCION';
    if (esRecepcion && dto.sedeId === undefined) {
      throw recepcionSinSede();
    }
    if (!esRecepcion && dto.sedeId !== undefined) {
      throw sedeSoloParaRecepcion(dto.rol);
    }
    const sedeId = esRecepcion ? dto.sedeId : undefined;

    const existente = await this.usuarios.buscarPorDniOEmail(dto.dni, dto.email);
    if (existente) {
      throw usuarioDuplicado(
        existente.dni === dto.dni
          ? `El DNI ${dto.dni} ya está registrado.`
          : `El email ${dto.email} ya está registrado.`,
      );
    }

    if (sedeId !== undefined) {
      if (!(await this.empleadosSede.existeSede(sedeId))) {
        throw sedeInexistente(sedeId);
      }
      if (await this.empleadosSede.buscarPorSedeId(sedeId)) {
        throw sedeConRecepcionista(sedeId);
      }
    }

    const contrasenia = await bcrypt.hash(dto.contrasenia, SALT_ROUNDS);
    let usuario: Usuario;
    try {
      usuario = await this.usuarios.crear({
        rol: dto.rol,
        dni: dto.dni,
        nombre: dto.nombre,
        email: dto.email,
        contrasenia,
        telefono: dto.telefono,
        fotoUrl: dto.fotoUrl,
        ...(sedeId !== undefined && { sedeId }),
      });
    } catch (error) {
      // Si dos altas compiten por la misma sede, el chequeo previo pasa en ambas
      // y la que pierde choca contra EmpleadoSede_sede_id_key: se traduce al mismo
      // 409. Un P2002 de otra columna (DNI/email) se deja subir como antes.
      if (sedeId !== undefined && mapearErrorPrisma(error) === 'UNIQUE' && esSedeUnica(error)) {
        throw sedeConRecepcionista(sedeId);
      }
      throw error;
    }

    return this.aOut(usuario);
  }

  async listar(dto: ListarUsuariosQueryDto): Promise<{ items: UsuarioOut[]; total: number }> {
    const { items, total } = await this.usuarios.listar(
      { rol: dto.rol, nombre: dto.nombre, email: dto.email },
      // Los defaults del DTO ya cubren el caso sin query params; estos `??`
      // son la red de seguridad para cuando el service se llame sin el pipe.
      { page: dto.page ?? 1, perPage: dto.perPage ?? 20 },
    );
    return {
      items: items.map((usuario) => this.aOut(usuario)),
      total,
    };
  }

  async obtenerPorId(id: number): Promise<UsuarioOut> {
    const usuario = await this.usuarios.buscarPorId(id);
    if (!usuario) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(usuario);
  }

  // Lo que el comprobante de pago (M5, RF-14) necesita del usuario para que el PDF
  // sea un snapshot con identidad: nombre y email, o null si el usuario no existe.
  // A diferencia de obtenerPorId() (que lanza 404 para el endpoint), acá el faltante
  // es un dato de salida del PDF, no un error: si la fila no está, el comprobante
  // imprime "no disponible" en vez de cortarse la generación a mitad.
  async buscarDatosParaComprobante(
    id: number,
  ): Promise<{ nombre: string; email: string } | null> {
    const usuario = await this.usuarios.buscarPorId(id);
    return usuario ? { nombre: usuario.nombre, email: usuario.email } : null;
  }

  async modificar(id: number, dto: UsuarioPatch): Promise<UsuarioOut> {
    const cambios: UsuarioActualizable = {};
    if (dto.nombre !== undefined) {
      cambios.nombre = dto.nombre;
    }
    if (dto.telefono !== undefined) {
      cambios.telefono = dto.telefono;
    }
    if (dto.fotoUrl !== undefined) {
      cambios.fotoUrl = dto.fotoUrl;
    }
    if (dto.contrasenia !== undefined) {
      cambios.contrasenia = await bcrypt.hash(dto.contrasenia, SALT_ROUNDS);
    }

    // Los cuatro campos del PATCH son opcionales, asi que con body {} el objeto
    // de cambios queda vacio. Prisma 6 interpreta un update sin campos como un
    // no-op y devuelve la fila sin error: la respuesta era un 200 que decia
    // "actualizado" sin haber actualizado nada. El contrato declara 422 para
    // esta operacion, asi que se corta aca.
    if (Object.keys(cambios).length === 0) {
      throw sinCamposParaModificar();
    }

    const usuario = await this.usuarios.actualizar(id, cambios);
    if (!usuario) {
      throw recursoNoEncontrado('No existe el recurso solicitado para el id indicado.');
    }
    return this.aOut(usuario);
  }

  private aOut(usuario: Usuario): UsuarioOut {
    return plainToInstance(UsuarioOut, usuario);
  }
}

// P2002 de Prisma: `meta.target` llega como lista de campos (Postgres) o como
// nombre de la constraint, segun version. Se aceptan las dos formas para no
// depender del detalle del driver.
function esSedeUnica(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  const target = error.meta?.target;
  const texto = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return texto.includes('sede_id') || texto.includes('EmpleadoSede_sede_id_key');
}