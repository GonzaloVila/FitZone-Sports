import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemFilter } from './commons/filters/problem.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

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
    .addTag('usuarios')
    .addTag('socios')
    .addTag('membresias')
    .addTag('sedes')
    .addTag('ingresos')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`FitZone API escuchando en http://localhost:${port}`);
}

bootstrap();