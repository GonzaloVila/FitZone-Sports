import { Module } from '@nestjs/common';
import { CommonsModule } from '../../commons/commons.module';
import { PagosModule } from '../m5-pagos/pagos.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './services/reportes.service';

// Unidad IV · CQRS. Este módulo es el READ SIDE: consulta, no transacciona.
// Grafo: reportes → M5 (importa PagosModule para leer el consolidado). M5 NO importa
// reportes, así que no hay ciclos.
@Module({
  imports: [CommonsModule, PagosModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
