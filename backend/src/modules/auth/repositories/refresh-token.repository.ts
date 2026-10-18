import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../commons/database/prisma.service';

export interface RefreshTokenNuevo {
  usuarioId: number;
  tokenHash: string;
  familia: string;
  expiraEn: Date;
}

export interface RefreshToken {
  id: number;
  usuarioId: number;
  familia: string;
  expiraEn: Date;
  usadoEn: Date | null;
  revocadoEn: Date | null;
}

// Capa de acceso a datos de los refresh tokens. Solo maneja hashes: el token en
// claro nunca llega hasta aca.
@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async crear(token: RefreshTokenNuevo): Promise<void> {
    await this.prisma.refreshToken.create({
      data: {
        usuario_id: token.usuarioId,
        token_hash: token.tokenHash,
        familia: token.familia,
        expira_en: token.expiraEn,
      },
    });
  }

  async buscarPorHash(tokenHash: string): Promise<RefreshToken | null> {
    const fila = await this.prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
    return fila
      ? {
          id: fila.id,
          usuarioId: fila.usuario_id,
          familia: fila.familia,
          expiraEn: fila.expira_en,
          usadoEn: fila.usado_en,
          revocadoEn: fila.revocado_en,
        }
      : null;
  }

  // UPDATE condicionado a que siga sin usar: dos refresh simultaneos con el mismo
  // token compiten por esta fila y solo uno afecta una fila. false = ya estaba usado.
  async marcarUsado(id: number, ahora: Date): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, usado_en: null },
      data: { usado_en: ahora },
    });
    return count === 1;
  }

  async revocarFamilia(familia: string, ahora: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familia, revocado_en: null },
      data: { revocado_en: ahora },
    });
  }

  async revocarTodasDelUsuario(usuarioId: number, ahora: Date): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuario_id: usuarioId, revocado_en: null },
      data: { revocado_en: ahora },
    });
  }
}
