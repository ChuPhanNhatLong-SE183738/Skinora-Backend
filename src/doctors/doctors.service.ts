import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { Doctor, DoctorDocument } from './entities/doctor.entity';
import { processWeeklyAvailability } from './utils/availability.util';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>,
    private jwtService: JwtService,
    private configService: ConfigService, // Add ConfigService
  ) {}

  async create(createDoctorDto: CreateDoctorDto) {
    try {
      if (createDoctorDto.availability) {
        createDoctorDto.availability = processWeeklyAvailability(
          createDoctorDto.availability,
        );
      }

      const newDoctor = new this.doctorModel(createDoctorDto);

      // Hash the password before saving
      if (newDoctor.password) {
        const salt = await bcrypt.genSalt(10);
        newDoctor.password = await bcrypt.hash(newDoctor.password, salt);
      }
      // Ensure email is stored in lowercase
      newDoctor.email = newDoctor.email.toLowerCase();
      // Check if a doctor with the same email already exists
      const existingDoctor = await this.doctorModel
        .findOne({ email: newDoctor.email })
        .exec();
      if (existingDoctor) {
        throw new BadRequestException(
          `Doctor with email ${newDoctor.email} already exists`,
        );
      }
      // Set default values for new doctor
      newDoctor.isActive = true; // Default to active
      newDoctor.lastLoginAt = new Date(); // Set last login to now

      return await newDoctor.save();
    } catch (error) {
      throw new BadRequestException(
        `Failed to create doctor: ${error.message}`,
      );
    }
  }

  async loginAsDoctor(email: string, password: string) {
    try {
      // Find doctor by email
      const doctor = await this.doctorModel
        .findOne({ email: email.toLowerCase() })
        .select('+password') // Include password field
        .exec();

      if (!doctor) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Check if doctor is active
      if (!doctor.isActive) {
        throw new UnauthorizedException('Doctor account is deactivated');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, doctor.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Generate JWT token with consistent secret
      const payload = {
        sub: (doctor._id as Types.ObjectId).toString(),
        email: doctor.email,
        role: 'doctor',
        doctorId: (doctor._id as Types.ObjectId).toString(),
        fullName: doctor.fullName,
        specializations: doctor.specializations,
      };

      const secret =
        this.configService.get<string>('JWT_SECRET') ||
        'skinora-jwt-secret-key';
      const accessToken = this.jwtService.sign(payload, {
        secret: secret,
        expiresIn: '7d',
      });

      // Update last login
      await this.doctorModel.findByIdAndUpdate(doctor._id, {
        lastLoginAt: new Date(),
      });

      // Return doctor info without password
      const { password: _, ...doctorInfo } = doctor.toObject();

      return {
        accessToken,
        doctor: doctorInfo,
        tokenType: 'Bearer',
        expiresIn: '7d',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Login failed: ' + error.message);
    }
  }

  async validateDoctorToken(doctorId: string) {
    try {
      const doctor = await this.doctorModel
        .findById(doctorId)
        .select('-password')
        .populate('specializations')
        .exec();

      if (!doctor || !doctor.isActive) {
        throw new UnauthorizedException('Doctor not found or inactive');
      }

      return doctor;
    } catch (error) {
      throw new UnauthorizedException('Invalid doctor token');
    }
  }

  async findAll() {
    return this.doctorModel
      .find({ isActive: true })
      .populate('specializations')
      .exec();
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    const doctor = await this.doctorModel
      .findById(id)
      .populate('specializations')
      .exec();
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    const excludedFields = [
      'password',
      'skinAnalysisHistory',
      'purchaseHistory',
    ];

    excludedFields.forEach((field) => {
      if (doctor[field]) {
        doctor[field] = undefined; // Exclude sensitive fields
      }
    });

    return doctor;
  }

  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    if (updateDoctorDto.availability) {
      updateDoctorDto.availability = processWeeklyAvailability(
        updateDoctorDto.availability,
      );
    }

    const doctor = await this.doctorModel
      .findByIdAndUpdate(id, updateDoctorDto, { new: true })
      .exec();

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    const result = await this.doctorModel.findByIdAndDelete(id).exec();

    if (!result) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return { deleted: true };
  }
  async updateAvailability(id: string, availability: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    // Process the new availability to ensure proper format
    const processedAvailability = processWeeklyAvailability(availability);

    // Completely replace the availability object to ensure old slots are removed
    const doctor = await this.doctorModel
      .findByIdAndUpdate(
        id,
        { 
          $set: { 
            availability: processedAvailability,
            updatedAt: new Date()
          }
        },
        { new: true, runValidators: true }
      )
      .exec();

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }

  async getDoctorProfile(doctorId: string) {
    const doctor = await this.doctorModel
      .findById(doctorId)
      .select('-password')
      .populate('specializations')
      .exec();

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  async updateDoctorProfile(
    doctorId: string,
    updateData: Partial<UpdateDoctorDto>,
  ) {
    const doctor = await this.doctorModel
      .findByIdAndUpdate(
        doctorId,
        { ...updateData, updatedAt: new Date() },
        { new: true },
      )
      .select('-password')
      .populate('specializations')
      .exec();

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    return doctor;
  }

  /**
   * Update doctor's photo URL
   */
  async updateDoctorPhoto(doctorId: string, photoUrl: string) {
    // Validate doctor ID
    if (!Types.ObjectId.isValid(doctorId)) {
      throw new BadRequestException('Invalid doctor ID');
    }

    // Validate photo URL format (basic validation)
    if (!photoUrl || typeof photoUrl !== 'string') {
      throw new BadRequestException('Valid photo URL is required');    }

    // More flexible URL validation that handles localhost and local development
    const urlPattern = /^(https?:\/\/)?(localhost|[\da-z\.-]+)(:\d+)?(\/[\w \.-]*)*\/?$/i;
    if (!urlPattern.test(photoUrl)) {
      throw new BadRequestException('Invalid photo URL format');
    }

    try {
      const updatedDoctor = await this.doctorModel
        .findByIdAndUpdate(
          doctorId,
          { 
            $set: { 
              photoUrl: photoUrl,
              updatedAt: new Date()
            }
          },
          { 
            new: true,
            runValidators: true
          }
        )
        .select('-password')
        .populate('specializations')
        .exec();

      if (!updatedDoctor) {
        throw new NotFoundException('Doctor not found');
      }

      return {
        success: true,
        message: 'Doctor photo updated successfully',
        data: updatedDoctor
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update doctor photo');
    }
  }
}
