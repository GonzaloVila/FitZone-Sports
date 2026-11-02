import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { PrismaService } from 'src/commons/database/prisma.service';
import { PRECIOS_PLAN } from 'src/modules/m1-usuarios/entities/membresia.entity';
import type { RolUsuario } from 'src/modules/m1-usuarios/entities/usuario.entity';
import { dniUnico, emailUnico } from './base-de-datos';

// Sesion real para los e2e que llaman a endpoints con JwtAuthGuard: login por HTTP (POST /auth/login), no un token firmado
// a mano. Las contrasenias de los usuarios que los fixtures crean por Prisma son un hash de relleno que no sirve para
// loguearse, asi que el helper les pone un hash real antes de iniciar sesion.
const CONTRASENIA = 'clave12345';

// Inicia sesion con un usuario que ya existe (por ejemplo el dueño de las reservas de un fixture) y devuelve su access token.
export async function iniciarSesion(app: INestApplication, prisma: PrismaService, usuarioId: number): Promise<string> {
  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { contrasenia: await bcrypt.hash(CONTRASENIA, 4) },
    select: { email: true },
  });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: usuario.email, contrasenia: CONTRASENIA })
    .expect(200);
  return res.body.accessToken as string;
}

// Crea un usuario nuevo del rol pedido (RECEPCION, GERENTE, EXTERNO... o SOCIO sin fila de socio) y le inicia sesion.
// `prefijoEmail` deja que la limpieza de cada suite (que borra por prefijo o por id) lo alcance; el login crea un refresh
// token y se borra en cascada con el usuario.
export async function crearUsuarioConSesion(
  app: INestApplication,
  prisma: PrismaService,
  rol: RolUsuario,
  prefijoEmail = 'e2e.sesion',
): Promise<{ usuarioId: number; token: string }> {
  const usuario = await prisma.usuario.create({
    data: {
      rol,
      dni: dniUnico(),
      nombre: `Usuario ${rol} E2E`,
      email: emailUnico(prefijoEmail),
      contrasenia: 'hash-de-relleno',
    },
  });
  return { usuarioId: usuario.id, token: await iniciarSesion(app, prisma, usuario.id) };
}

// Crea un RECEPCION con su sede de trabajo (EmpleadoSede) y le inicia sesion: el token trae `sedeId`, que se fija al login,
// asi que la fila se crea antes. EmpleadoSede es 1:1 con la sede y con el usuario, y no se borra en cascada: la limpieza de la
// suite tiene que borrar `empleadoSede` por `usuario_id` antes que el usuario.
export async function crearRecepcionConSesion(
  app: INestApplication,
  prisma: PrismaService,
  sedeId: number,
  prefijoEmail = 'e2e.sesion',
): Promise<{ usuarioId: number; token: string }> {
  const usuario = await prisma.usuario.create({
    data: {
      rol: 'RECEPCION',
      dni: dniUnico(),
      nombre: 'Usuario RECEPCION E2E',
      email: emailUnico(prefijoEmail),
      contrasenia: 'hash-de-relleno',
    },
  });
  await prisma.empleadoSede.create({ data: { usuario_id: usuario.id, sede_id: sedeId } });
  return { usuarioId: usuario.id, token: await iniciarSesion(app, prisma, usuario.id) };
}

// Crea un SOCIO real (usuario + fila de socio + membresia MENSUAL vigente) y le inicia sesion: el token trae `socioId`, que se
// fija al login, asi que el socio se crea antes. La limpieza es de la suite (membresia -> socio -> usuario).
export async function crearSocioConSesion(
  app: INestApplication,
  prisma: PrismaService,
  sedeId: number,
  prefijoEmail = 'e2e.sesion',
): Promise<{ usuarioId: number; socioId: number; token: string }> {
  const usuario = await prisma.usuario.create({
    data: {
      rol: 'SOCIO',
      dni: dniUnico(),
      nombre: 'Usuario SOCIO E2E',
      email: emailUnico(prefijoEmail),
      contrasenia: 'hash-de-relleno',
    },
  });
  const socio = await prisma.socio.create({
    data: { usuario_id: usuario.id, sede_origen_id: sedeId, fecha_alta: new Date() },
  });
  const ahora = new Date();
  const fechaFin = new Date(ahora);
  fechaFin.setDate(fechaFin.getDate() + 30);
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
  return { usuarioId: usuario.id, socioId: socio.id, token: await iniciarSesion(app, prisma, usuario.id) };
}

// Cliente de supertest que manda siempre el mismo token: para los e2e que arman datos por HTTP con una sesion fija (por
// ejemplo, un GERENTE que da de alta usuarios y socios) sin repetir `.set(conToken(token))` en cada llamada.
export function clienteCon(app: INestApplication, token: string) {
  const server = app.getHttpServer();
  const con = (llamada: request.Test) => llamada.set(conToken(token));
  return {
    get: (url: string) => con(request(server).get(url)),
    post: (url: string) => con(request(server).post(url)),
    patch: (url: string) => con(request(server).patch(url)),
    delete: (url: string) => con(request(server).delete(url)),
  };
}

export const conToken = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });
