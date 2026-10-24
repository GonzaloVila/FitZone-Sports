import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Usuario } from 'src/modules/m1-usuarios/entities/usuario.entity';
import type { SociosService } from 'src/modules/m1-usuarios/services/socios.service';
import type { UsuarioParaAutenticar, UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';
import { AuthService } from 'src/modules/auth/auth.service';
import type {
  RefreshToken,
  RefreshTokenNuevo,
  RefreshTokenRepository,
} from 'src/modules/auth/repositories/refresh-token.repository';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

// Repositorio en memoria con la misma semantica que el de Prisma (marcarUsado
// condicional, revocar solo lo no revocado).
class RefreshTokenesEnMemoria {
  filas: Array<RefreshToken & { tokenHash: string }> = [];
  private seq = 0;

  async crear(t: RefreshTokenNuevo): Promise<void> {
    this.filas.push({
      id: ++this.seq,
      usuarioId: t.usuarioId,
      tokenHash: t.tokenHash,
      familia: t.familia,
      expiraEn: t.expiraEn,
      usadoEn: null,
      revocadoEn: null,
    });
  }

  async buscarPorHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.filas.find((f) => f.tokenHash === tokenHash) ?? null;
  }

  async marcarUsado(id: number, ahora: Date): Promise<boolean> {
    const fila = this.filas.find((f) => f.id === id && f.usadoEn === null);
    if (!fila) return false;
    fila.usadoEn = ahora;
    return true;
  }

  async revocarFamilia(familia: string, ahora: Date): Promise<void> {
    for (const f of this.filas) if (f.familia === familia && f.revocadoEn === null) f.revocadoEn = ahora;
  }

  async revocarTodasDelUsuario(usuarioId: number, ahora: Date): Promise<void> {
    for (const f of this.filas) if (f.usuarioId === usuarioId && f.revocadoEn === null) f.revocadoEn = ahora;
  }
}

const JWT_EXPIRES_IN = 900;
const REFRESH_EXPIRES_IN = 604800;

function usuarioBase(over: Partial<UsuarioParaAutenticar> = {}): UsuarioParaAutenticar {
  const base: Usuario & { sedeId: number | null } = {
    id: 7,
    rol: 'RECEPCION',
    dni: '30111222',
    nombre: 'Rita',
    email: 'rita@fitzone.test',
    contrasenia: bcrypt.hashSync('clave12345', 4),
    telefono: null,
    fotoUrl: null,
    sedeId: 5,
  };
  return { ...base, ...over };
}

function armar(usuario: UsuarioParaAutenticar | null = usuarioBase()) {
  const repo = new RefreshTokenesEnMemoria();
  let actual = usuario;

  const usuarios = {
    buscarParaAutenticar: async (email: string) => (actual?.email === email ? actual : null),
    buscarParaAutenticarPorId: async (id: number) => (actual?.id === id ? actual : null),
  } as unknown as UsuariosService;
  const socios = { obtenerSocioIdPorUsuario: async () => 12 } as unknown as SociosService;
  const config = {
    get: (clave: string) => ({ JWT_EXPIRES_IN, REFRESH_EXPIRES_IN })[clave],
  } as unknown as ConfigService;
  const jwt = new JwtService({ secret: 'secreto-de-test' });

  const service = new AuthService(usuarios, socios, jwt, config, repo as unknown as RefreshTokenRepository);
  return { service, repo, jwt, cambiarUsuario: (u: UsuarioParaAutenticar | null) => (actual = u) };
}

const credenciales = { email: 'rita@fitzone.test', contrasenia: 'clave12345' };

describe('AuthService: login', () => {
  it('emite access token y un refresh token en una familia nueva, guardando solo su hash', async () => {
    const { service, repo, jwt } = armar();

    const { respuesta, refreshToken } = await service.login(credenciales);

    const payload = jwt.decode(respuesta.accessToken) as Record<string, unknown>;
    expect(payload).toMatchObject({ sub: 7, rol: 'RECEPCION', sedeId: 5 });
    expect(respuesta).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: JWT_EXPIRES_IN,
      rol: 'RECEPCION',
      usuarioId: 7,
      sedeId: 5,
    });
    expect(respuesta.refreshToken).toBeUndefined();

    expect(refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repo.filas).toHaveLength(1);
    expect(repo.filas[0].tokenHash).toBe(hash(refreshToken));
    expect(JSON.stringify(repo.filas)).not.toContain(refreshToken);
    const vida = repo.filas[0].expiraEn.getTime() - Date.now();
    expect(vida).toBeGreaterThan((REFRESH_EXPIRES_IN - 5) * 1000);
    expect(vida).toBeLessThanOrEqual(REFRESH_EXPIRES_IN * 1000);
  });

  it('dos logins abren dos familias distintas', async () => {
    const { service, repo } = armar();
    await service.login(credenciales);
    await service.login(credenciales);
    expect(new Set(repo.filas.map((f) => f.familia)).size).toBe(2);
  });

  it('credenciales invalidas dan 401 y no crean refresh token', async () => {
    const { service, repo } = armar();
    await expect(service.login({ ...credenciales, contrasenia: 'mala' })).rejects.toMatchObject({ status: 401 });
    await expect(service.login({ email: 'nadie@x.test', contrasenia: 'x' })).rejects.toMatchObject({ status: 401 });
    expect(repo.filas).toHaveLength(0);
  });

  it('un SOCIO lleva socioId en el access token y no lleva sedeId', async () => {
    const { service, jwt } = armar(usuarioBase({ rol: 'SOCIO', sedeId: null }));
    const { respuesta } = await service.login(credenciales);
    const payload = jwt.decode(respuesta.accessToken) as Record<string, unknown>;
    expect(payload).toMatchObject({ rol: 'SOCIO', socioId: 12 });
    expect(payload).not.toHaveProperty('sedeId');
  });
});

describe('AuthService: refrescar', () => {
  let ctx: ReturnType<typeof armar>;
  let token: string;

  beforeEach(async () => {
    ctx = armar();
    token = (await ctx.service.login(credenciales)).refreshToken;
  });

  it('un token valido rota: el viejo queda usado y el nuevo nace en la misma familia', async () => {
    const { respuesta, refreshToken } = await ctx.service.refrescar(token);

    expect(refreshToken).not.toBe(token);
    expect(respuesta.accessToken).toBeTruthy();
    expect(respuesta.refreshToken).toBeUndefined();
    const [viejo, nuevo] = ctx.repo.filas;
    expect(viejo.usadoEn).not.toBeNull();
    expect(nuevo.usadoEn).toBeNull();
    expect(nuevo.familia).toBe(viejo.familia);
    expect(nuevo.tokenHash).toBe(hash(refreshToken));
  });

  it('el access token nuevo sale con el rol y la sede actuales, no con los del login', async () => {
    ctx.cambiarUsuario(usuarioBase({ sedeId: 9 }));
    const { respuesta } = await ctx.service.refrescar(token);
    expect(respuesta.sedeId).toBe(9);
    expect((ctx.jwt.decode(respuesta.accessToken) as Record<string, unknown>).sedeId).toBe(9);
  });

  it('con un token ya usado revoca todas las sesiones del usuario, incluso otras familias y el token nuevo', async () => {
    const otraSesion = await ctx.service.login(credenciales);
    const rotado = await ctx.service.refrescar(token);

    await expect(ctx.service.refrescar(token)).rejects.toMatchObject({ status: 401 });

    expect(ctx.repo.filas.every((f) => f.revocadoEn !== null)).toBe(true);
    await expect(ctx.service.refrescar(rotado.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(ctx.service.refrescar(otraSesion.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('si marcarUsado pierde la carrera (afecta cero filas) se trata como reuso', async () => {
    ctx.repo.marcarUsado = async () => false;
    await expect(ctx.service.refrescar(token)).rejects.toMatchObject({ status: 401 });
    expect(ctx.repo.filas.every((f) => f.revocadoEn !== null)).toBe(true);
  });

  it('vencido, revocado e inexistente dan el mismo 401', async () => {
    const vencido = (await ctx.service.login(credenciales)).refreshToken;
    ctx.repo.filas.find((f) => f.tokenHash === hash(vencido))!.expiraEn = new Date(Date.now() - 1000);

    const revocado = (await ctx.service.login(credenciales)).refreshToken;
    await ctx.service.cerrarSesion(revocado);

    const errores: unknown[] = [];
    for (const t of [vencido, revocado, 'token-que-no-existe']) {
      errores.push(await ctx.service.refrescar(t).then(() => null, (e: unknown) => e));
    }

    for (const e of errores) expect(e).toMatchObject({ status: 401 });
    const respuestas = errores.map((e) => JSON.stringify((e as { getResponse(): unknown }).getResponse()));
    expect(new Set(respuestas).size).toBe(1);
  });

  it('vencido, revocado o inexistente no revocan el resto de las sesiones', async () => {
    await ctx.service.refrescar('token-que-no-existe').catch(() => undefined);
    expect(ctx.repo.filas.every((f) => f.revocadoEn === null)).toBe(true);
  });

  it('si el usuario ya no existe da 401', async () => {
    ctx.cambiarUsuario(null);
    await expect(ctx.service.refrescar(token)).rejects.toMatchObject({ status: 401 });
  });
});

describe('AuthService: cerrarSesion', () => {
  it('revoca toda la familia del token y deja intactas las otras sesiones', async () => {
    const ctx = armar();
    const sesionA = (await ctx.service.login(credenciales)).refreshToken;
    const sesionB = (await ctx.service.login(credenciales)).refreshToken;
    const rotadoA = (await ctx.service.refrescar(sesionA)).refreshToken;

    await ctx.service.cerrarSesion(rotadoA);

    const familiaA = ctx.repo.filas.find((f) => f.tokenHash === hash(sesionA))!.familia;
    expect(ctx.repo.filas.filter((f) => f.familia === familiaA).every((f) => f.revocadoEn !== null)).toBe(true);
    expect(ctx.repo.filas.find((f) => f.tokenHash === hash(sesionB))!.revocadoEn).toBeNull();
    await expect(ctx.service.refrescar(rotadoA)).rejects.toMatchObject({ status: 401 });
  });

  it('es idempotente: token inexistente o ya revocado no es error', async () => {
    const ctx = armar();
    const token = (await ctx.service.login(credenciales)).refreshToken;

    await expect(ctx.service.cerrarSesion('token-que-no-existe')).resolves.toBeUndefined();
    await ctx.service.cerrarSesion(token);
    const revocadoEn = ctx.repo.filas[0].revocadoEn;
    await expect(ctx.service.cerrarSesion(token)).resolves.toBeUndefined();
    expect(ctx.repo.filas[0].revocadoEn).toBe(revocadoEn);
  });
});
