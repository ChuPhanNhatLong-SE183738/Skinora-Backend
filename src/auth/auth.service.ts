import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UserDocument } from '../users/entities/user.entity';
// import { CartService } from '../cart/cart.service'; // Import CartService
import { Types } from 'mongoose';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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

  async register(createUserDto: CreateUserDto, response: Response) {
    // Create the user
    const user = (await this.usersService.create(
      createUserDto,
    )) as UserDocument;

    // Create an empty cart for the new user
    // await this.cartService.create({
    //   userId: (user as any)._id.toString(),
    //   items: [],
    //   totalAmount: 0,
    // });

    const payload = {
      email: user.email,
      sub: user._id ? user._id.toString() : user.id?.toString(),
      userId: user._id, // Add userId for convenience
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    this.setAuthCookie(response, token);

    return {
      message: 'Registration successful',
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
}
