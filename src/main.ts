import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Skinora API')
    .setDescription('The Skinora API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin:
      // process.env.FRONTEND_URL ||
      // 'http://localhost:3000' ||
      'http://localhost:8081',
    credentials: true,
  });

  // Request logging to help debug auth issues
  app.use((req, res, next) => {
    Logger.log(`${req.method} ${req.url}`, 'Request');
    next();
  });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.debug(`Environment variables: 
    VNPAY_TMN_CODE: ${process.env.VNPAY_TMN_CODE?.substring(0, 3)}...
    VNPAY_RETURN_URL: ${process.env.VNPAY_RETURN_URL}
    VNPAY_URL: ${process.env.VNPAY_URL}
  `);
}
bootstrap();
