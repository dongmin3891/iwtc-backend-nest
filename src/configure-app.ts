import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/http-exception.filter.js';

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: config.get<string[]>('CORS_ORIGINS'),
    credentials: true,
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IWTC API')
    .setDescription('IWTC 프론트엔드용 NestJS API')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
}
