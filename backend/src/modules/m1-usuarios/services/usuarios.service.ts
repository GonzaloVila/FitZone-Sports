import { HttpStatus, Injectable } from '@nestjs/common';
import {
  GENERIC_TYPE,
  ProblemException,
  TITLES,
  conflictoDeDominio,
  recursoNoEncontrado,
} from '../../../commons/filters/problem.exception';
import * as bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { UsuarioIn } from '../dtos/usuario-in.dto';
import { ListarUsuariosQueryDto } from '../dtos/listar-usuarios-query.dto';
import { UsuarioPatch } from '../dtos/usuario-patch.dto';
import { UsuarioOut } from '../dtos/usuario-out.dto';
import { Usuario, UsuarioActualizable } from '../entities/usuario.entity';
import { EmpleadoSedeRepository } from '../repositories/empleado-sede.repository';
import { UsuarioRepository } from '../repositories/usuario.repository';

const SALT_ROUNDS = 10;

export interface UsuarioParaAutenticar extends Usuario {
  // null salvo RECEPCION con fila en EmpleadoSede. No confundir con
  // Socio.sede_origen_id (RF-03): este es la sucursal de trabajo del staff.
  sede_id: number | null;
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
    if (!usuario) {
      return null;
    }

    let sede_id: number | null = null;
    if (usuario.rol === 'RECEPCION') {
      const empleado = await this.empleadosSede.buscarPorUsuarioId(usuario.id);
      sede_id = empleado?.sede_id ?? null;
    }

    return { ...usuario, sede_id };
  }

  async crear(dto: UsuarioIn): Promise<UsuarioOut> {
    const existente = await this.usuarios.buscarPorDniOEmail(dto.dni, dto.email);
    if (existente) {
      throw conflictoDeDominio(
        'Conflicto de unicidad',
        existente.dni === dto.dni
          ? `El DNI ${dto.dni} ya está registrado.`
          : `El email ${dto.email} ya está registrado.`,
      );
    }

    const contrasenia = await bcrypt.hash(dto.contrasenia, SALT_ROUNDS);
    const usuario = await this.usuarios.crear({
      rol: dto.rol,
      dni: dto.dni,
      nombre: dto.nombre,
      email: dto.email,
      contrasenia,
      telefono: dto.telefono,
      foto_url: dto.foto_url,
    });

    return this.aOut(usuario);
  }

  async listar(dto: ListarUsuariosQueryDto): Promise<UsuarioOut[]> {
    const usuarios = await this.usuarios.listar(
      { rol: dto.rol, nombre: dto.nombre, email: dto.email },
      // Los defaults del DTO ya cubren el caso sin query params; estos `??`
      // son la red de seguridad para cuando el service se llame sin el pipe.
      { page: dto.page ?? 1, perPage: dto.per_page ?? 20 },
    );
    return usuarios.map((usuario) => this.aOut(usuario));
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
    if (dto.foto_url !== undefined) {
      cambios.foto_url = dto.foto_url;
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
      throw new ProblemException({
        type: GENERIC_TYPE,
        title: TITLES[HttpStatus.UNPROCESSABLE_ENTITY],
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'Se debe enviar al menos un campo para modificar.',
      });
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