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
    origin: [
      'http://localhost:3000',
      'http://localhost:5173', // Vite frontend
      'http://localhost:5174', // Alternative Vite port
      'http://192.168.1.2:3000',
      'http://192.168.1.2:5173',
      '*',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  // Request logging to help debug auth issues
  app.use((req, res, next) => {
    Logger.log(`${req.method} ${req.url}`, 'Request');
    if (req.headers.authorization) {
      Logger.debug(
        `Auth header: ${req.headers.authorization.substring(0, 20)}...`,
        'Auth',
      );
    }
    next();
  });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 3000;
  await app.listen(3000, '0.0.0.0');
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.debug(`Environment variables: 
    VNPAY_TMN_CODE: ${process.env.VNPAY_TMN_CODE?.substring(0, 3)}...
    VNPAY_RETURN_URL: ${process.env.VNPAY_RETURN_URL}
    VNPAY_URL: ${process.env.VNPAY_URL}
  `);
  console.log('🚀 Server running on http://0.0.0.0:3000');
  console.log('📞 Call WebSocket available on ws://192.168.1.2:3000/call');
  console.log('💬 Chat WebSocket available on ws://192.168.1.2:3000/chat');
}
bootstrap();
