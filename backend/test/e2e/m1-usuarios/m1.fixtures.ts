import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { emailUnico } from '@test/helpers/base-de-datos';

// Fixtures compartidos por los e2e de M1 (antes en m1.e2e-spec.ts). Crea la sede y
// expone el email de socio (prefijo `socio.`, que usa la limpieza) y la limpieza.
export async function crearContextoM1(app: INestApplication, prisma: PrismaService) {
  const sede = await prisma.sede.create({
    data: { nombre: 'Sede Test E2E', direccion: 'Calle Falsa 123', aforo_maximo: 50 },
  });
  const sedeId = sede.id;

  const emailSocio = () => emailUnico('socio');

  // Limpieza acotada a los datos de M1 (prefijo de email `socio.`), en orden inverso
  // a las FKs. El alta cobra la membresia (RF-02) y la baja conserva el Pago como
  // historial: los pagos se borran por el email del USUARIO, no por la membresia.
  async function limpiar(): Promise<void> {
    const emailM1 = { email: { startsWith: 'socio.' } };
    const pagos = await prisma.pago.findMany({ where: { usuario: emailM1 }, select: { id: true } });
    const idsPagos = pagos.map((p) => p.id);
    await prisma.pagoMembresia.deleteMany({
      where: idsPagos.length > 0 ? { id_pago: { in: idsPagos } } : { id_pago: -1 },
    });
    if (idsPagos.length > 0) {
      await prisma.pago.deleteMany({ where: { id: { in: idsPagos } } });
    }
    const mio = { usuario: emailM1 };
    await prisma.membresia.deleteMany({ where: { socio: mio } });
    await prisma.socio.deleteMany({ where: mio });
    await prisma.usuario.deleteMany({ where: emailM1 });
    await prisma.sede.delete({ where: { id: sedeId } });
  }

  return { sedeId, emailSocio, limpiar };
}
