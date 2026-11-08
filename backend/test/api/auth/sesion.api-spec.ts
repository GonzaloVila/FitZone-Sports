import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from 'src/commons/database/prisma.service';
import { crearApp, emailUnico } from '@test/helpers/base-de-datos';

// Sesion con refresh token: login web (cookie) y movil (body), rotacion, deteccion de
// reuso, CSRF por Origin y logout. Los usuarios se crean directo con Prisma y se
// borran al final (el refresh token cae por cascada).
describe('Sesión: refresh token y logout (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let origenPermitido: string;
  let sameSite: string;
  let maxAge: number;

  const usuariosCreados: number[] = [];
  const COOKIE = 'refresh_token';

  async function crearUsuario(): Promise<string> {
    const email = emailUnico('sesion');
    const usuario = await prisma.usuario.create({
      data: {
        rol: 'EXTERNO',
        dni: String(40000000 + Math.floor(Math.random() * 59999999)),
        nombre: 'Sesion E2E',
        email,
        contrasenia: await bcrypt.hash('clave12345', 4),
      },
    });
    usuariosCreados.push(usuario.id);
    return email;
  }

  const http = () => request(app.getHttpServer());

  function loginWeb(email: string) {
    return http().post('/api/v1/auth/login').send({ email, contrasenia: 'clave12345' });
  }

  function loginMovil(email: string) {
    return http().post('/api/v1/auth/login').set('X-Cliente', 'movil').send({ email, contrasenia: 'clave12345' });
  }

  // "refresh_token=abc; Max-Age=...; Path=..." -> los atributos de la cookie.
  function setCookie(res: request.Response): string | undefined {
    const cabeceras = (res.headers['set-cookie'] ?? []) as unknown as string[];
    return cabeceras.find((c) => c.startsWith(`${COOKIE}=`));
  }

  function valorDeCookie(res: request.Response): string {
    return setCookie(res)!.split(';')[0].slice(COOKIE.length + 1);
  }

  const conCookie = (valor: string) => `${COOKIE}=${valor}`;

  beforeAll(async () => {
    ({ app, prisma } = await crearApp());
    const config = app.get(ConfigService);
    origenPermitido = config.get<string[]>('CORS_ORIGINS')![0];
    sameSite = config.get<string>('REFRESH_COOKIE_SAMESITE')!;
    maxAge = config.get<number>('REFRESH_EXPIRES_IN')!;
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { id: { in: usuariosCreados } } });
    await app.close();
  });

  it('login web setea la cookie refresh_token HttpOnly con Path, SameSite y Max-Age, y no devuelve refreshToken en el body', async () => {
    const res = await loginWeb(await crearUsuario()).expect(200);

    const cookie = setCookie(res)!;
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie.toLowerCase()).toContain(`samesite=${sameSite}`);
    expect(cookie).toContain(`Max-Age=${maxAge}`);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body).not.toHaveProperty('refreshToken');
  });

  it('login con X-Cliente: movil devuelve refreshToken en el body y no setea cookie', async () => {
    const res = await loginMovil(await crearUsuario()).expect(200);

    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.accessToken).toBeTruthy();
    expect(setCookie(res)).toBeUndefined();
  });

  it('refresh por cookie con Origin válido rota: devuelve otro access token, otra cookie y nada en el body', async () => {
    const login = await loginWeb(await crearUsuario()).expect(200);
    const viejo = valorDeCookie(login);

    const res = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie(viejo))
      .set('Origin', origenPermitido)
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body).not.toHaveProperty('refreshToken');
    const cookie = setCookie(res)!;
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(valorDeCookie(res)).not.toBe(viejo);
  });

  it('refresh por cookie sin Origin o con Origin no permitido da 403 origen-no-permitido y no rota', async () => {
    const login = await loginWeb(await crearUsuario()).expect(200);
    const token = valorDeCookie(login);

    const sinOrigen = await http().post('/api/v1/auth/refresh').set('Cookie', conCookie(token)).expect(403);
    expect(sinOrigen.body).toMatchObject({
      type: 'https://fitzone.app/errores/origen-no-permitido',
      title: 'Origen no permitido',
      status: 403,
    });

    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie(token))
      .set('Origin', 'https://sitio-malicioso.test')
      .expect(403);

    // El 403 no consumio el token: sigue sirviendo con un Origin valido.
    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie(token))
      .set('Origin', origenPermitido)
      .expect(200);
  });

  it('refresh por body (móvil) rota sin Origin y responde por body, sin cookie', async () => {
    const login = await loginMovil(await crearUsuario()).expect(200);

    const res = await http().post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(login.body.refreshToken);
    expect(setCookie(res)).toBeUndefined();
  });

  it('si vienen body y cookie manda el body (y se responde por body)', async () => {
    const email = await crearUsuario();
    const web = await loginWeb(email).expect(200);
    const movil = await loginMovil(email).expect(200);

    const res = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie(valorDeCookie(web)))
      .send({ refreshToken: movil.body.refreshToken })
      .expect(200);

    expect(res.body.refreshToken).toBeTruthy();
    expect(setCookie(res)).toBeUndefined();
  });

  it('reusar el token viejo da 401 y deja sin sesión al token nuevo y a las demás sesiones', async () => {
    const email = await crearUsuario();
    const otraSesion = await loginMovil(email).expect(200);
    const login = await loginMovil(email).expect(200);
    const viejo = login.body.refreshToken as string;

    const rotado = await http().post('/api/v1/auth/refresh').send({ refreshToken: viejo }).expect(200);
    const nuevo = rotado.body.refreshToken as string;

    const reuso = await http().post('/api/v1/auth/refresh').send({ refreshToken: viejo }).expect(401);
    expect(reuso.body.status).toBe(401);

    await http().post('/api/v1/auth/refresh').send({ refreshToken: nuevo }).expect(401);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: otraSesion.body.refreshToken }).expect(401);
  });

  it('dos refresh simultáneos con el mismo token: solo uno rota y el otro cuenta como reuso', async () => {
    const login = await loginMovil(await crearUsuario()).expect(200);
    const token = login.body.refreshToken as string;

    const [a, b] = await Promise.all([
      http().post('/api/v1/auth/refresh').send({ refreshToken: token }),
      http().post('/api/v1/auth/refresh').send({ refreshToken: token }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 401]);
    const ganador = a.status === 200 ? a : b;
    // El reuso revoco todas las sesiones, tambien la que acaba de rotar.
    await http().post('/api/v1/auth/refresh').send({ refreshToken: ganador.body.refreshToken }).expect(401);
  });

  it('refresh fallido por cookie (401) borra la cookie con Max-Age 0', async () => {
    const res = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie('token-que-no-existe'))
      .set('Origin', origenPermitido)
      .expect(401);

    const cookie = setCookie(res)!;
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/api/v1/auth');
    expect(cookie.startsWith(`${COOKIE}=;`)).toBe(true);
  });

  it('refresh inexistente, mal formado o sin token dan el mismo 401 genérico', async () => {
    const inexistente = await http().post('/api/v1/auth/refresh').send({ refreshToken: 'no-existe' }).expect(401);
    const sinToken = await http().post('/api/v1/auth/refresh').send({}).expect(401);

    expect(inexistente.body.detail).toBe(sinToken.body.detail);
    expect(inexistente.body.type).toBe('about:blank');
  });

  it('refreshToken vacío o de otro tipo en el body da 422 de validación', async () => {
    await http().post('/api/v1/auth/refresh').send({ refreshToken: '' }).expect(422);
    await http().post('/api/v1/auth/refresh').send({ refreshToken: 123 }).expect(422);
    await http().post('/api/v1/auth/refresh').send({ otroCampo: 'x' }).expect(422);
  });

  it('logout por cookie borra la cookie, deja inservible el token y el refresh posterior da 401', async () => {
    const login = await loginWeb(await crearUsuario()).expect(200);
    const token = valorDeCookie(login);

    const res = await http()
      .post('/api/v1/auth/logout')
      .set('Cookie', conCookie(token))
      .set('Origin', origenPermitido)
      .expect(204);

    const cookie = setCookie(res)!;
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/api/v1/auth');

    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie(token))
      .set('Origin', origenPermitido)
      .expect(401);
  });

  it('logout revoca solo la sesión del dispositivo: las otras sesiones del usuario siguen vivas', async () => {
    const email = await crearUsuario();
    const a = await loginMovil(email).expect(200);
    const b = await loginMovil(email).expect(200);

    await http().post('/api/v1/auth/logout').send({ refreshToken: a.body.refreshToken }).expect(204);

    await http().post('/api/v1/auth/refresh').send({ refreshToken: a.body.refreshToken }).expect(401);
    // El 401 de arriba es un token revocado (no un reuso): no toca la otra familia.
    await http().post('/api/v1/auth/refresh').send({ refreshToken: b.body.refreshToken }).expect(200);
  });

  it('logout por cookie sin Origin o con Origin no permitido da 403 y no revoca nada', async () => {
    const login = await loginWeb(await crearUsuario()).expect(200);
    const token = valorDeCookie(login);

    await http().post('/api/v1/auth/logout').set('Cookie', conCookie(token)).expect(403);
    await http()
      .post('/api/v1/auth/logout')
      .set('Cookie', conCookie(token))
      .set('Origin', 'https://sitio-malicioso.test')
      .expect(403);

    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', conCookie(token))
      .set('Origin', origenPermitido)
      .expect(200);
  });

  it('logout es idempotente y público: token desconocido, repetido o ausente dan 204 sin bearer', async () => {
    const login = await loginMovil(await crearUsuario()).expect(200);
    const token = login.body.refreshToken as string;

    await http().post('/api/v1/auth/logout').send({ refreshToken: 'no-existe' }).expect(204);
    await http().post('/api/v1/auth/logout').send({ refreshToken: token }).expect(204);
    await http().post('/api/v1/auth/logout').send({ refreshToken: token }).expect(204);
    await http().post('/api/v1/auth/logout').expect(204);
  });

  it('en la base queda solo el hash SHA-256 del refresh token, nunca el token', async () => {
    const email = await crearUsuario();
    const login = await loginMovil(email).expect(200);
    const token = login.body.refreshToken as string;

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email } });
    const filas = await prisma.refreshToken.findMany({ where: { usuario_id: usuario.id } });

    expect(filas).toHaveLength(1);
    expect(filas[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(filas[0].token_hash).not.toBe(token);
    expect(JSON.stringify(filas)).not.toContain(token);
  });
});
