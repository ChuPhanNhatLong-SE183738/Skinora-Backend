import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { ObjectId } from 'mongodb';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secretKey = configService.get<string>('JWT_SECRET');
    if (!secretKey) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    // Custom extractor để log token
    super({
      jwtFromRequest: (req) => {
        const authHeader = req?.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          console.log('>>> [JwtStrategy] Received Token:', token); // ✅ Log token
          return token;
        }
        return null;
      },
      ignoreExpiration: false,
      secretOrKey: secretKey,
    });
  }

  async validate(payload: any) {
    try {
      console.log('>>> [JwtStrategy] Extracted Payload:', payload); // ✅ Log payload

      // Check for email in payload since sub might not be available
      if (!payload || (!payload.sub && !payload.email)) {
        this.logger.warn('JWT payload is missing both sub and email');
        throw new UnauthorizedException('Invalid token: missing user identifier');
      }

      let user;
      
      // Try to find the user by sub (ID) first if it exists
      if (payload.sub) {
        try {
          user = await this.usersService.findOne(payload.sub);
        } catch (error) {
          this.logger.warn(`Could not find user with ID ${payload.sub}: ${error.message}`);
          // Fall back to email lookup if ID lookup fails
        }
      }
      
      // If no user found by ID or no sub provided, try email
      if (!user && payload.email) {
        try {
          user = await this.usersService.findByEmail(payload.email);
        } catch (error) {
          this.logger.warn(`Could not find user with email ${payload.email}: ${error.message}`);
          throw new UnauthorizedException('User not found');
        }
      }
      
      if (!user) {
        this.logger.warn('User not found with provided credentials');
        throw new UnauthorizedException('User not found');
      }

      const plainUser = user.toObject ? user.toObject() : { ...user };

      return {
        _id: plainUser._id,
        id: plainUser._id.toString(),
        email: plainUser.email,
        role: plainUser.role,
        // Include both in the return value for compatibility
        sub: payload.sub || plainUser._id.toString(),
      };
    } catch (error) {
      this.logger.error('JWT validation failed', error.stack || error.message);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
