import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/commons/database/prisma.service';
import { ProblemFilter } from 'src/commons/filters/problem.filter';
import type { PlanMembresia } from 'src/modules/m1-usuarios/entities/membresia.entity';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import type { RolUsuario } from 'src/modules/m1-usuarios/entities/usuario.entity';

// Helpers compartidos por los e2e (antes duplicados en cada archivo).
// El bootstrap de Nest es identico en todas las suites: AppModule + prefijo
// /api/v1 + ValidationPipe + ProblemFilter.

export interface AppDeTest {
  app: INestApplication;
  prisma: PrismaService;
}

export async function crearApp(): Promise<AppDeTest> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ProblemFilter());
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

// Email unico por corrida, con prefijo de modulo para que la limpieza sea
// inequivoca entre suites que comparten la base.
export function emailUnico(prefijo: string): string {
  return `${prefijo}.${Date.now()}.${Math.floor(Math.random() * 100000)}@e2e.fitzone.test`;
}

export function dniUnico(): string {
  return String(10000000 + Math.floor(Math.random() * 89999999));
}

export async function crearSede(prisma: PrismaService): Promise<number> {
  const sede = await prisma.sede.create({
    data: { nombre: 'Sede Test E2E', direccion: 'Calle Falsa 123', aforo_maximo: 50 },
  });
  return sede.id;
}

export async function crearUsuario(prisma: PrismaService, rol: RolUsuario): Promise<number> {
  const usuario = await prisma.usuario.create({
    data: {
      rol,
      dni: dniUnico(),
      nombre: `Usuario ${rol} E2E`,
      email: emailUnico(rol.toLowerCase()),
      contrasenia: 'hash-no-relevante',
    },
  });
  return usuario.id;
}

// Socio con membresia creados directo con Prisma (sin pasar por el alta HTTP):
// lo usan los e2e que necesitan un socio ya vigente/en mora como precondicion.
export async function crearSocioConMembresia(
  prisma: PrismaService,
  opts: { sedeId: number; vigente: boolean; plan?: PlanMembresia },
): Promise<{ socioId: number; usuarioId: number }> {
  const usuarioId = await crearUsuario(prisma, 'SOCIO');

  const socio = await prisma.socio.create({
    data: { usuario_id: usuarioId, sede_origen_id: opts.sedeId, fecha_alta: new Date() },
  });

  const plan: PlanMembresia = opts.plan ?? 'MENSUAL';
  const ahora = new Date();
  const fechaFin = new Date(ahora);
  fechaFin.setDate(fechaFin.getDate() + (opts.vigente ? 30 : -5));

  await prisma.membresia.create({
    data: {
      socio_id: socio.id,
      plan,
      estado: opts.vigente ? 'ACTIVA' : 'VENCIDA',
      fecha_inicio: ahora,
      fecha_fin: fechaFin,
      precio: PRECIOS_PLAN[plan],
      renueva_automatica: false,
    },
  });

  return { socioId: socio.id, usuarioId };
}
