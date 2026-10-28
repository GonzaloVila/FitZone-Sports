import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type { PrismaService } from 'src/commons/database/prisma.service';
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

export const conToken = (token: string): { Authorization: string } => ({ Authorization: `Bearer ${token}` });
