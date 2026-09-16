import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const prismaLogOptions: Prisma.LogDefinition[] = [
  { emit: 'event', level: 'query' },
  { emit: 'stdout', level: 'warn' },
  { emit: 'stdout', level: 'error' },
];

@Injectable()
export class PrismaService
  extends PrismaClient<{ log: typeof prismaLogOptions }>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: prismaLogOptions });

    this.$on('query', (e) => {
      this.logger.debug(
        `\n${e.query}\nParams: ${e.params}\nDuration: ${e.duration}ms`,
      );
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado a PostgreSQL (Supabase)');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Conexión a PostgreSQL cerrada');
  }
}