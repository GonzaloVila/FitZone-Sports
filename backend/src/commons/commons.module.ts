// Modulo transversal (infraestructura compartida): database, filters, guards.
//
// Antes exportaba `MediadorService`, que era la unica razon de existir como
// modulo aparte: `commons/mediador/` era el punto de indireccion entre M1/M4 y
// M5. Con M5 en capas y la comunicacion directa por services, no queda nada que
// exportar. Se conserva el modulo porque es el lugar natural para lo transversal
// que si aparece (el ProblemFilter y el pipe global hoy se aplican en main.ts, y
// un filtro de autorizacion por rol vivira aca).
import { Module } from '@nestjs/common';

@Module({})
export class CommonsModule {}
