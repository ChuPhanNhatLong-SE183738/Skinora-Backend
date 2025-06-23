import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailService } from './email.service';

@Module({
  imports: [
    UsersModule,
    DoctorsModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') || 'skinora-jwt-secret-key',
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy, EmailService],
  exports: [AuthService],
})
export class AuthModule {}
