import { Module, OnModuleInit } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { UsuariosModule } from '../m1-usuarios/usuarios.module';
import { GimnasioModule } from '../m2-gimnasio/gimnasio.module';
import { ClasesController } from './controllers/clases.controller';
import { EsperasClasesController } from './controllers/esperas-clases.controller';
import { ReservasClasesController } from './controllers/reservas-clases.controller';
import { CupoLiberadoSubject } from './observers/cupo-liberado.subject';
import { EmailCupoLiberadoObserver } from './observers/email-cupo-liberado.observer';
import { NotificarSociosEsperaObserver } from './observers/notificar-socios-espera.observer';
import { ClaseRepository } from './repositories/clase.repository';
import { EsperaClaseRepository } from './repositories/espera-clase.repository';
import { ReservaClaseRepository } from './repositories/reserva-clase.repository';
import { ClasesService } from './services/clases.service';
import { EsperasClasesService } from './services/esperas-clases.service';
import { ReservasClasesService } from './services/reservas-clases.service';

// M3 depende de M1 (RN-03 en reservas y esperas, y el email del observer de cupo
// liberado) y de M2 (la sede de una clase nueva debe existir). No exporta nada:
// ningun otro modulo necesita leer la cola de espera o el cupo de una clase.
@Module({
  imports: [CommonsModule, UsuariosModule, GimnasioModule],
  controllers: [
    ClasesController,
    ReservasClasesController,
    EsperasClasesController,
  ],
  providers: [
    ClaseRepository,
    ReservaClaseRepository,
    EsperaClaseRepository,
    ClasesService,
    ReservasClasesService,
    EsperasClasesService,
    CupoLiberadoSubject,
    NotificarSociosEsperaObserver,
    EmailCupoLiberadoObserver,
  ],
})
export class ClasesModule implements OnModuleInit {
  constructor(
    private readonly cupoSubject: CupoLiberadoSubject,
    private readonly notificarEsperaObserver: NotificarSociosEsperaObserver,
    private readonly emailObserver: EmailCupoLiberadoObserver,
  ) {}

  onModuleInit(): void {
    // Registro de observadores en el Subject GoF al inicializar el módulo.
    // La cadena es [estado, email]: el primero lleva EN_ESPERA -> NOTIFICADO y el
    // segundo avisa por correo. El observer de email usa listarSociosEnEsperaPorClase
    // (cola viva, sin CANCELADO) y no buscarEnEsperaPorClase, asi que le da igual
    // correr antes o despues del cambio de estado.
    this.cupoSubject.registrarObserver(this.notificarEsperaObserver);
    this.cupoSubject.registrarObserver(this.emailObserver);
  }
}
