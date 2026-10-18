import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemFilter } from './commons/filters/problem.filter';
import { markRequestSchemasClosed } from './commons/swagger/mark-request-schemas';
import { marcarSchemasDePagos } from './commons/swagger/marcar-schemas-pagos';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const configService = app.get(ConfigService);

  // Con credentials: true el navegador rechaza origin '*', por eso es una lista
  // explicita (CORS_ORIGINS). Los headers propios del contrato van declarados.
  app.enableCors({
    origin: configService.get<string[]>('CORS_ORIGINS'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cliente', 'Idempotency-Key'],
    exposedHeaders: ['Location'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new ProblemFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FitZone Sports API')
    .setDescription('Backend de FitZone Sports — Unidad II · SCRUM-11')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('usuarios')
    .addTag('socios')
    .addTag('membresias')
    .addTag('bloqueados')
    .addTag('sedes')
    .addTag('ingresos')
    .addTag('clases')
    .addTag('reservas-clases')
    .addTag('esperas-clases')
    .addTag('canchas')
    .addTag('reservas-canchas')
    .addTag('pagos')
    .addTag('reportes')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  markRequestSchemasClosed(swaggerDocument);
  marcarSchemasDePagos(swaggerDocument);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`FitZone API escuchando en http://localhost:${port}`);
}

bootstrap();