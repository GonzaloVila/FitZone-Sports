import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { dniUnico, emailUnico } from '@test/helpers/base-de-datos';

// Fixtures compartidos por los e2e de M4 (antes en m4.e2e-spec.ts). Crea la sede y
// la cancha base, y expone el alta de socio/externo, los horarios del dia y la limpieza.
export async function crearContextoM4(app: INestApplication, prisma: PrismaService) {
  const usuariosCreados: number[] = [];
  const sociosCreados: number[] = [];
  const sedesCreadas: number[] = [];
  const canchasCreadas: number[] = [];

  const sede = await prisma.sede.create({
    data: { nombre: 'Sede E2E M4', direccion: 'Calle Falsa 456', aforo_maximo: 50 },
  });
  const sedeId = sede.id;
  sedesCreadas.push(sede.id);

  const cancha = await prisma.cancha.create({
    data: { sede_id: sedeId, tipo: 'FUTBOL5', costo_por_hora: 5000, estado: 'OPERATIVA' },
  });
  const canchaId = cancha.id;
  canchasCreadas.push(cancha.id);

  // Horarios con offset explicito -03:00: representan sin ambiguedad la hora local de
  // la sede. Dia lejano para no chocar con reservas de otros tests.
  const DIA = '2026-11-12';
  const inicio = (hhmm: string) => `${DIA}T${hhmm}:00-03:00`;
  const fin = (hhmm: string) => `${DIA}T${hhmm}:00-03:00`;

  async function crearExterno(nombre = 'Externo E2E M4'): Promise<number> {
    const usuario = await prisma.usuario.create({
      data: { rol: 'EXTERNO', dni: dniUnico(), nombre, email: emailUnico('m4'), contrasenia: 'hash-no-relevante' },
    });
    usuariosCreados.push(usuario.id);
    return usuario.id;
  }

  // Devuelve el id de Usuario (la FK de Reserva es usuarioId -> Usuario).
  async function crearSocio(opts: { vigente: boolean }): Promise<number> {
    const usuario = await prisma.usuario.create({
      data: { rol: 'SOCIO', dni: dniUnico(), nombre: 'Socio E2E M4', email: emailUnico('m4'), contrasenia: 'hash-no-relevante' },
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
        estado: 'ACTIVA',
        fecha_inicio: ahora,
        fecha_fin: fechaFin,
        precio: PRECIOS_PLAN.MENSUAL,
        renueva_automatica: false,
      },
    });

    return usuario.id;
  }

  // Orden inverso a las FKs: pago_reserva -> reserva -> cancha -> membresia -> socio -> usuario -> sede.
  async function limpiar(): Promise<void> {
    await prisma.pagoReserva.deleteMany({ where: { reserva: { cancha_id: { in: canchasCreadas } } } });
    await prisma.reserva.deleteMany({ where: { cancha_id: { in: canchasCreadas } } });
    await prisma.cancha.deleteMany({ where: { id: { in: canchasCreadas } } });
    await prisma.membresia.deleteMany({ where: { socio_id: { in: sociosCreados } } });
    await prisma.socio.deleteMany({ where: { id: { in: sociosCreados } } });
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await prisma.sede.deleteMany({ where: { id: { in: sedesCreadas } } });
  }

  return {
    sedeId,
    canchaId,
    usuariosCreados,
    sociosCreados,
    sedesCreadas,
    canchasCreadas,
    DIA,
    inicio,
    fin,
    crearExterno,
    crearSocio,
    limpiar,
  };
}
