import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserDocument } from '../users/entities/user.entity';
// import { CartService } from '../cart/cart.service'; // Import CartService
import { Types } from 'mongoose';
import * as crypto from 'crypto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
    // private cartService: CartService, // Inject CartService
  ) {}

  async validateUser(email: string, password: string) {
    try {
      const user = await this.usersService.findByEmail(email);
      const isPasswordValid = await this.usersService.validatePassword(
        password,
        user.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const { password: _, ...result } = user.toObject();
      return result;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async login(user: any, response: Response) {
    const payload = {
      email: user.email,
      sub: user._id ? user._id.toString() : user.id?.toString(), // Handle both _id and id formats
      userId: user._id, // Add userId for convenience
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    this.setAuthCookie(response, token);

    return {
      message: 'Login successful',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || null,
        address: user.address || null,
        dob: user.dob || null,
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
      },
      token: token,
    };
  }

  async verifyUser(token: string, email: string) {
    try {
      const decoded = this.verifyToken(token);
      if (decoded.email !== email) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.usersService.findByEmail(email);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      user.isVerified = true;
      await user.save();

      return {
        message: 'User verified successfully',
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone || null,
          address: user.address || null,
          dob: user.dob || null,
          avatarUrl: user.avatarUrl || null,
          role: user.role,
          isActive: user.isActive,
          isVerified: user.isVerified,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Verification failed: ' + error.message);
    }
  }
  async register(createUserDto: CreateUserDto, response: Response) {
    // Create the user
    const user = (await this.usersService.create(
      createUserDto,
    )) as UserDocument;

    // Generate verification token
    await this.generateVerificationToken(user);

    const payload = {
      email: user.email,
      sub: user._id ? user._id.toString() : user.id?.toString(),
      userId: user._id, // Add userId for convenience
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    this.setAuthCookie(response, token);

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || null,
        address: user.address || null,
        dob: user.dob || null,
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        isActive: user.isActive,
        isVerified: user.isVerified,
      },
    };
  }

  async logout(response: Response) {
    this.clearAuthCookie(response);
    return { message: 'Logout successful' };
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie('Authentication', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/',
    });
  }

  private clearAuthCookie(response: Response) {
    response.cookie('Authentication', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: new Date(0),
      path: '/',
    });
  }

  verifyToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async getUserFromToken(token: string) {
    const decoded = this.verifyToken(token);
    return this.usersService.findById(decoded.sub);
  }

  async getProfile(userId: string) {
    try {
      const user = await this.usersService.findById(userId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const userObject = user.toObject();

      return {
        id: userObject._id,
        email: userObject.email,
        fullName: userObject.fullName,
        role: userObject.role,
        phone: userObject.phone || null,
        address: userObject.address || null,
        dob: userObject.dob || null,
        avatarUrl: userObject.avatarUrl || null,
        isActive: userObject.isActive,
        isVerified: userObject.isVerified,
        skinAnalysisHistory: userObject.skinAnalysisHistory || [],
        purchaseHistory: userObject.purchaseHistory || [],
        createdAt: userObject.createdAt,
        updatedAt: userObject.updatedAt,
      };
    } catch (error) {
      throw new UnauthorizedException('User not found');
    }
  }

  async getMyProfile(userId: string) {
    try {
      const user = await this.usersService.findById(userId);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const userObject = user.toObject();

      return {
        id: userObject._id,
        email: userObject.email,
        fullName: userObject.fullName,
        role: userObject.role,
        phone: userObject.phone || null,
        address: userObject.address || null,
        dob: userObject.dob || null,
        avatarUrl: userObject.avatarUrl || null,
        isActive: userObject.isActive,
        isVerified: userObject.isVerified,
        skinAnalysisHistory: userObject.skinAnalysisHistory || [],
        purchaseHistory: userObject.purchaseHistory || [],
        createdAt: userObject.createdAt,
        updatedAt: userObject.updatedAt,
      };
    } catch (error) {
      throw new UnauthorizedException('Failed to fetch user profile');
    }
  }

  // Email verification methods
  async verifyEmail(token: string) {
    try {
      // Find user by verification token
      const user = await this.usersService.findByVerificationToken(token);

      if (!user) {
        throw new BadRequestException('Invalid or expired verification token');
      }
      if (!user.verificationTokenCreatedAt) {
        throw new BadRequestException('Invalid verification token');
      }

      const tokenAge = Date.now() - user.verificationTokenCreatedAt.getTime();
      if (tokenAge > 24 * 60 * 60 * 1000) {
        // 24 hours in milliseconds
        throw new BadRequestException('Verification token has expired');
      } // Update user verification status
      user.isVerified = true;
      user.verificationToken = null;
      user.verificationTokenCreatedAt = null;
      await user.save();

      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.fullName);

      return {
        verified: true,
        user: {
          id: user._id,
          email: user.email,
          isVerified: user.isVerified,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Email verification failed');
    }
  }

  async resendVerificationEmail(email: string) {
    try {
      const user = await this.usersService.findByEmail(email);

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if (user.isVerified) {
        throw new BadRequestException('Email is already verified');
      }

      // Generate new verification token
      const verificationToken = crypto.randomBytes(32).toString('hex'); // Update user with new token
      user.verificationToken = verificationToken;
      user.verificationTokenCreatedAt = new Date();
      await user.save();

      // Send verification email
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationToken,
      );

      return { message: 'Verification email sent successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to resend verification email');
    }
  }
  async generateVerificationToken(user: UserDocument): Promise<string> {
    const verificationToken = crypto.randomBytes(32).toString('hex');

    user.verificationToken = verificationToken;
    user.verificationTokenCreatedAt = new Date();
    await user.save();

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      verificationToken,
    );

    // Save HTML preview for development
    await this.emailService.saveEmailTemplatePreview(
      user.email,
      verificationToken,
      user.fullName,
    );

    return verificationToken;
  }
}
