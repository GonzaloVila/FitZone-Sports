import { describe, expect, it } from 'vitest';
import type { Usuario } from 'src/modules/m1-usuarios/entities/usuario.entity';
import type { EmpleadoSedeRepository } from 'src/modules/m1-usuarios/repositories/empleado-sede.repository';
import type { UsuarioRepository } from 'src/modules/m1-usuarios/repositories/usuario.repository';
import { UsuariosService } from 'src/modules/m1-usuarios/services/usuarios.service';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    id: 7,
    rol: 'SOCIO',
    dni: '30111222',
    nombre: 'Ana',
    email: 'ana@fitzone.test',
    contrasenia: 'hash',
    telefono: null,
    fotoUrl: null,
    ...over,
  };
}

// Repositorios en memoria: buscarParaAutenticarPorId solo compone buscarPorId con
// la sede del staff, no depende de la conexion.
function service(fila: Usuario | null, sedeId: number | null = 5) {
  const usuarios = { buscarPorId: async () => fila } as unknown as UsuarioRepository;
  const empleados = {
    buscarPorUsuarioId: async () => (sedeId === null ? null : { id: 1, usuarioId: 7, sedeId }),
  } as unknown as EmpleadoSedeRepository;
  return new UsuariosService(usuarios, empleados);
}

describe('UsuariosService.buscarParaAutenticarPorId', () => {
  it('RECEPCION con fila de staff devuelve su sedeId', async () => {
    const res = await service(usuario({ rol: 'RECEPCION' }), 5).buscarParaAutenticarPorId(7);
    expect(res).toMatchObject({ id: 7, rol: 'RECEPCION', sedeId: 5 });
  });

  it('RECEPCION sin fila de staff devuelve sedeId null', async () => {
    const res = await service(usuario({ rol: 'RECEPCION' }), null).buscarParaAutenticarPorId(7);
    expect(res?.sedeId).toBeNull();
  });

  it('un rol distinto de RECEPCION devuelve sedeId null aunque exista una fila de staff', async () => {
    const res = await service(usuario({ rol: 'GERENTE' }), 5).buscarParaAutenticarPorId(7);
    expect(res).toMatchObject({ rol: 'GERENTE', sedeId: null });
  });

  it('si el usuario no existe devuelve null', async () => {
    expect(await service(null).buscarParaAutenticarPorId(7)).toBeNull();
  });
});
