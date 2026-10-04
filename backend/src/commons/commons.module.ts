// Modulo transversal (infraestructura compartida): database, filters, guards.
//
// PassportModule se registra aca y se exporta (no en AuthModule) porque es lo
// unico que necesita cualquier modulo que use JwtAuthGuard/RolesGuard en sus
// controllers: AuthGuard('jwt') (de @nestjs/passport) pide `AuthModuleOptions`
// por DI, y ese provider solo es visible donde PassportModule fue importado.
// UsuariosModule y GimnasioModule no pueden importar AuthModule (quien lo
// importa es AuthModule -> UsuariosModule; importarlo de vuelta seria un
// ciclo), pero los dos ya importan CommonsModule, que es el lugar donde esto
// vive sin crear ninguna dependencia nueva. La JwtStrategy en si (quien
// registra la estrategia 'jwt' en passport) sigue viviendo solo en AuthModule.
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  exports: [PassportModule],
})
export class CommonsModule {}
