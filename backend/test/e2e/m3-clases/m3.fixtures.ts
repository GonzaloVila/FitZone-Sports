import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { dniUnico, emailUnico } from '@test/helpers/base-de-datos';

// Fixtures compartidos por los e2e de M3 (antes en m3.e2e-spec.ts). Crea la sede y
// expone el alta de socio+membresia, el helper de rango horario y la limpieza.
export async function crearContextoM3(app: INestApplication, prisma: PrismaService) {
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const clasesCreadas: number[] = [];
  const pagosDePenalidad: number[] = [];
  const reservasClasesConPenalidad: number[] = [];

  const sede = await prisma.sede.create({
    data: { nombre: 'Sede E2E Clases', direccion: 'Av. Corrientes 1234', aforo_maximo: 100 },
  });
  const sedeId = sede.id;

  // RF-06: la clase tiene rango horario. Fin = inicio + 1 h para los cuerpos de POST /clases.
  const finDe = (iso: string) => new Date(new Date(iso).getTime() + 3600 * 1000).toISOString();

  async function crearSocioConMembresia(opts: { vigente: boolean }) {
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'SOCIO',
        dni: dniUnico(),
        nombre: 'Socio E2E M3',
        email: emailUnico('m3'),
        contrasenia: 'hash-no-relevante',
      },
    });
    usuariosCreados.push(usuario.id);

    const socio = await prisma.socio.create({
      data: { usuario_id: usuario.id, sede_origen_id: sedeId, fecha_alta: new Date() },
    });
    sociosCreados.push(socio.id);

    const ahora = new Date();
    const fechaFin = new Date(ahora);
    fechaFin.setDate(fechaFin.getDate() + (opts.vigente ? 30 : -5));

    await prisma.membresia.create({
      data: {
        socio_id: socio.id,
        plan: 'MENSUAL',
        estado: opts.vigente ? 'ACTIVA' : 'VENCIDA',
        fecha_inicio: new Date(ahora.getTime() - 15 * 86400000),
        fecha_fin: fechaFin,
        precio: PRECIOS_PLAN.MENSUAL,
        renueva_automatica: false,
      },
    });

    return { usuarioId: usuario.id, socioId: socio.id };
  }

  // Limpieza en orden inverso a las FKs. La penalidad (RF-07) es un Pago que
  // referencia la reserva: se limpia ANTES que la reserva (FK restrict).
  async function limpiar(): Promise<void> {
    await prisma.esperaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.pagoReservaClase.deleteMany({
      where: { reserva_clase_id: { in: reservasClasesConPenalidad } },
    });
    await prisma.pago.deleteMany({ where: { id: { in: pagosDePenalidad } } });
    await prisma.reservaClase.deleteMany({ where: { clase_id: { in: clasesCreadas } } });
    await prisma.clase.deleteMany({ where: { id: { in: clasesCreadas } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.delete({ where: { id: sedeId } });
  }

  return {
    sedeId,
    usuariosCreados,
    sociosCreados,
    clasesCreadas,
    pagosDePenalidad,
    reservasClasesConPenalidad,
    finDe,
    crearSocioConMembresia,
    limpiar,
  };
}
