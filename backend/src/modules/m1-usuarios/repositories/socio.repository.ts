import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { mapearErrorPrisma } from '../../../commons/errors/prisma.mapper';
import type { OpcionesPaginacion } from '../../../commons/paginacion';
import { PRECIOS_PLAN, calcularVigencia } from '../entities/membresia.entity';
import type { EstadoMembresia, PlanMembresia } from '../entities/membresia.entity';
import type { Socio, SocioActualizable, SocioNuevo } from '../entities/socio.entity';

// En nomenclatura de dominio (snake_case), no la del contrato. El service
// traduce desde el query DTO, que si usa camelCase para los filtros.
export interface FiltrosSocios {
  sedeOrigenId?: number;
  estadoMembresia?: EstadoMembresia;
  plan?: PlanMembresia;
  nombre?: string;
}

export interface SocioTotp {
  socioId: number;
  totpSecreto: string | null;
  qrActivo: boolean;
}

// SocioOut expone nombre/email, asi que toda lectura de Socio necesita la
// relacion con Usuario. Se declara el payload a mano (no `typeof` de la const)
// porque SocioGetPayload exige los select en literal `true`, no `boolean`.
const USUARIO_SELECCION = {
  usuario: { select: { nombre: true, email: true } },
};

type SocioRow = Prisma.SocioGetPayload<{
  include: { usuario: { select: { nombre: true; email: true } } };
}>;

// Capa de acceso a datos del socio. Es la unica pieza de M1 que conoce Prisma:
// los services de arriba reciben el tipo `Socio`, nunca una fila de Prisma.
@Injectable()
export class SocioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listar(
    { sedeOrigenId, estadoMembresia, plan, nombre }: FiltrosSocios,
    { page, perPage }: OpcionesPaginacion,
  ): Promise<Socio[]> {
    const where: Prisma.SocioWhereInput = {
      // Baja logica: el listado y las lecturas de vigencia solo ven socios activos.
      activo: true,
      ...(sedeOrigenId !== undefined && {
        sede_origen_id: sedeOrigenId,
      }),
      ...(nombre !== undefined && {
        usuario: { nombre: { contains: nombre, mode: 'insensitive' } },
      }),
    };

    // Los dos filtros de membresia se acumulan en el MISMO objeto para que
    // Prisma los ANDee sobre la relacion.
    if (estadoMembresia !== undefined || plan !== undefined) {
      where.membresia = {
        ...(estadoMembresia !== undefined && { estado: estadoMembresia }),
        ...(plan !== undefined && { plan }),
      };
    }

    const filas = await this.prisma.socio.findMany({
      where,
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { id: 'asc' },
      include: USUARIO_SELECCION,
    });
    return filas.map((fila) => this.aDominio(fila));
  }

  async crear(socio: SocioNuevo): Promise<Socio> {
    const fila = await this.prisma.$transaction(async (tx) => {
      // `calcularVigencia` sin segundo argumento toma hoy como fechaInicio.
      const { fechaInicio, fechaFin } = calcularVigencia(socio.plan);
      const precio = PRECIOS_PLAN[socio.plan];

      // Re-alta: si el usuario ya tuvo un Socio (baja logica previa), se REACTIVA
      // esa misma fila en vez de insertar otra (el @unique(usuarioId) lo impide).
      const existente = await tx.socio.findUnique({
        where: { usuario_id: socio.usuarioId },
      });

      if (existente) {
        const reactivado = await tx.socio.update({
          where: { usuario_id: socio.usuarioId },
          data: { activo: true, fecha_baja: null, sede_origen_id: socio.sedeOrigenId },
          include: USUARIO_SELECCION,
        });

        // La membresia es 1:1: se re-aprovecha la fila y se recobra el plan nuevo.
        await tx.membresia.update({
          where: { socio_id: existente.id },
          data: {
            plan: socio.plan,
            estado: 'ACTIVA',
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            precio,
            renueva_automatica: false,
          },
        });

        await tx.usuario.update({
          where: { id: socio.usuarioId },
          data: { rol: 'SOCIO' },
        });

        return reactivado;
      }

      const nuevoSocio = await tx.socio.create({
        data: {
          usuario_id: socio.usuarioId,
          sede_origen_id: socio.sedeOrigenId,
          fecha_alta: new Date(),
        },
        // Ojo: este snapshot del Usuario es previo al update de `rol` de mas
        // abajo. No afecta a SocioOut (no expone `rol`), pero si alguna vez lo
        // agrega, saldra desactualizado en el POST /socios.
        include: USUARIO_SELECCION,
      });

      // No existe un socio sin membresia: la fila 1:1 se crea siempre, en la
      // misma transaccion que el socio.
      await tx.membresia.create({
        data: {
          socio_id: nuevoSocio.id,
          plan: socio.plan,
          estado: 'ACTIVA',
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          precio,
          renueva_automatica: false,
        },
      });

      await tx.usuario.update({
        where: { id: socio.usuarioId },
        data: { rol: 'SOCIO' },
      });

      return nuevoSocio;
    });

    return this.aDominio(fila);
  }

  async buscarPorId(id: number): Promise<Socio | null> {
    // findFirst (no findUnique) porque se filtra por `activo`, que no es parte
    // de la clave: un socio dado de baja devuelve null -> 404.
    const fila = await this.prisma.socio.findFirst({
      where: { id, activo: true },
      include: USUARIO_SELECCION,
    });
    return fila ? this.aDominio(fila) : null;
  }

  async buscarPorUsuarioId(usuarioId: number): Promise<Socio | null> {
    // Critico: la vigencia (M2/M3/M4) pasa por aca. Un ex-socio (activo=false)
    // tiene que dar null, o seguiria considerandose vigente tras la baja.
    const fila = await this.prisma.socio.findFirst({
      where: { usuario_id: usuarioId, activo: true },
      include: USUARIO_SELECCION,
    });
    return fila ? this.aDominio(fila) : null;
  }

  // totpSecreto/qrActivo no viven en la entidad Socio ni en SocioOut: son
  // detalle de autenticacion (RF-04), no del perfil publico del socio. Por
  // eso estos dos metodos devuelven su propia forma en vez de ensanchar
  // `Socio`, y los consume unicamente TotpService (modules/auth).
  async buscarTotpPorUsuarioId(usuarioId: number): Promise<SocioTotp | null> {
    const fila = await this.prisma.socio.findFirst({
      where: { usuario_id: usuarioId, activo: true },
      select: { id: true, totp_secreto: true, qr_activo: true },
    });
    if (!fila) {
      return null;
    }
    return { socioId: fila.id, totpSecreto: fila.totp_secreto, qrActivo: fila.qr_activo };
  }

  // Para la validacion del QR por SOCIO (M2 ahora referencia socioId): el secreto
  // y el estado del QR de un socio concreto, sin pasar por el usuario. Un socio
  // inactivo (baja logica) devuelve null -> el ingreso no valida.
  async buscarTotpPorSocioId(socioId: number): Promise<SocioTotp | null> {
    const fila = await this.prisma.socio.findFirst({
      where: { id: socioId, activo: true },
      select: { id: true, totp_secreto: true, qr_activo: true },
    });
    if (!fila) {
      return null;
    }
    return { socioId: fila.id, totpSecreto: fila.totp_secreto, qrActivo: fila.qr_activo };
  }

  async guardarTotpSecreto(usuarioId: number, secretoCifrado: string): Promise<void> {
    await this.prisma.socio.update({
      where: { usuario_id: usuarioId },
      data: { totp_secreto: secretoCifrado, qr_activo: true },
    });
  }

  async actualizar(id: number, cambios: SocioActualizable): Promise<Socio | null> {
    try {
      const fila = await this.prisma.socio.update({
        where: { id },
        data: {
          ...(cambios.sedeOrigenId !== undefined && {
            sede_origen_id: cambios.sedeOrigenId,
          }),
        },
        include: USUARIO_SELECCION,
      });
      return this.aDominio(fila);
    } catch (error) {
      if (mapearErrorPrisma(error) === 'NO_ENCONTRADO') {
        return null;
      }
      throw error;
    }
  }

  // Baja LOGICA: no se borra el socio ni su membresia. Se marca `activo=false`
  // (con `fecha_baja`), la membresia pasa a SUSPENDIDA y el usuario vuelve a
  // EXTERNO. El historial de ingresos/pagos conserva la FK al socio.
  async marcarBaja(id: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const socio = await tx.socio.findUnique({ where: { id } });
      if (!socio) {
        return;
      }
      await tx.socio.update({
        where: { id },
        data: { activo: false, fecha_baja: new Date() },
      });
      await tx.membresia.updateMany({
        where: { socio_id: id },
        data: { estado: 'SUSPENDIDA' },
      });
      await tx.usuario.update({
        where: { id: socio.usuario_id },
        data: { rol: 'EXTERNO' },
      });
    });
  }

  private aDominio(fila: SocioRow): Socio {
    return {
      id: fila.id,
      usuarioId: fila.usuario_id,
      nombre: fila.usuario.nombre,
      email: fila.usuario.email,
      sedeOrigenId: fila.sede_origen_id,
      fechaAlta: fila.fecha_alta,
      activo: fila.activo,
      fechaBaja: fila.fecha_baja,
    };
  }
}
