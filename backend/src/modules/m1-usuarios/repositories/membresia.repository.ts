import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../commons/database/prisma.service';
import { PRECIOS_PLAN, calcularVigencia } from '../entities/membresia.entity';
import type { Membresia, MembresiaActualizable } from '../entities/membresia.entity';

type MembresiaRow = Prisma.MembresiaGetPayload<Record<string, never>>;

// La fila con el cruce a Socio, que es la que consume el caso de uso de cobro de M5:
// la membresía no tiene usuario_id, lo tiene el socio, y Pago.usuario_id lo necesita.
// El join queda adentro de M1, que es dueña de las dos tablas, y el tipo viene del
// schema para no escribirlo a mano.
type MembresiaConSocioRow = Prisma.MembresiaGetPayload<{
  include: { socio: { select: { usuario_id: true } } };
}>;

// Capa de acceso a datos de la membresia. Es la unica pieza de M1 que conoce
// Prisma: los services de arriba reciben el tipo `Membresia`.
@Injectable()
export class MembresiaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async buscarPorSocioId(socioId: number): Promise<Membresia | null> {
    const fila = await this.prisma.membresia.findUnique({
      where: { socio_id: socioId },
    });
    return fila ? this.aDominio(fila) : null;
  }

  // Lectura minima para el caso de uso de cobro: la fila con el socio adjunto. Va
  // acá y no en el service de M5 para que la tabla Membresia se consulte desde un
  // solo lugar (ADR-07).
  async obtenerParaCobro(membresiaId: number): Promise<MembresiaConSocioRow | null> {
    return this.prisma.membresia.findUnique({
      where: { id: membresiaId },
      include: { socio: { select: { usuario_id: true } } },
    });
  }

  async actualizar(
    socioId: number,
    cambios: MembresiaActualizable,
  ): Promise<Membresia | null> {
    const data: Prisma.MembresiaUpdateInput = {
      plan: cambios.plan,
      renueva_automatica: cambios.renueva_automatica,
      estado: cambios.estado,
    };

    if (cambios.plan) {
      // Cambiar el plan mueve TRES cosas y ninguna puede quedar sin la otra:
      //   - el precio, que si no se actualizaria un socio que baja de ANUAL a
      //     MENSUAL y sigue pagando el precio del anual;
      //   - fecha_inicio y fecha_fin, juntas, porque el periodo nuevo arranca HOY
      //     (regla del contrato) y escribir solo la fecha_fin dejaba la fila con un
      //     par imposible: el alta original con un fin contado desde hoy.
      // El ancla de la renovacion automatica es la fecha_fin PREVIA, no esta; son
      // operaciones distintas y por eso los periodos quedan contiguos al renovar.
      data.precio = PRECIOS_PLAN[cambios.plan];
      const periodo = calcularVigencia(cambios.plan, new Date());
      data.fecha_inicio = periodo.fecha_inicio;
      data.fecha_fin = periodo.fecha_fin;
    }

    const fila = await this.prisma.membresia
      .update({
        where: { socio_id: socioId },
        data,
      })
      .catch((err) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          return null;
        }
        throw err;
      });

    return fila ? this.aDominio(fila) : null;
  }

  async marcarVencidas(): Promise<number> {
    const resultado = await this.prisma.membresia.updateMany({
      where: { estado: 'ACTIVA', fecha_fin: { lt: new Date() } },
      data: { estado: 'VENCIDA' },
    });
    return resultado.count;
  }

  private aDominio(fila: MembresiaRow): Membresia {
    return {
      id: fila.id,
      socio_id: fila.socio_id,
      plan: fila.plan,
      estado: fila.estado,
      fecha_inicio: fila.fecha_inicio,
      fecha_fin: fila.fecha_fin,
      precio: fila.precio.toNumber(),
      renueva_automatica: fila.renueva_automatica,
    };
  }
}
