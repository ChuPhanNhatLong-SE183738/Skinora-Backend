import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { Doctor, DoctorDocument } from './entities/doctor.entity';
import { processWeeklyAvailability } from './utils/availability.util';

@Injectable()
export class DoctorsService {
  constructor(
    @InjectModel(Doctor.name) private doctorModel: Model<DoctorDocument>
  ) { }

  async create(createDoctorDto: CreateDoctorDto) {
    try {
      if (createDoctorDto.availability) {
        createDoctorDto.availability = processWeeklyAvailability(createDoctorDto.availability);
      }

      const newDoctor = new this.doctorModel(createDoctorDto);
      return await newDoctor.save();
    } catch (error) {
      throw new BadRequestException(`Failed to create doctor: ${error.message}`);
    }
  }

  async findAll() {
  return this.doctorModel.find({ isActive: true })
    .populate('specializations')
    .exec();
}

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    const doctor = await this.doctorModel.findById(id)
      .populate('specializations')
      .exec();
    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }


  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid doctor ID format');
    }

    if (updateDoctorDto.availability) {
      updateDoctorDto.availability = processWeeklyAvailability(updateDoctorDto.availability);
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

    const processedAvailability = processWeeklyAvailability(availability);

    const doctor = await this.doctorModel
      .findByIdAndUpdate(
        id,
        { availability: processedAvailability },
        { new: true }
      )
      .exec();

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }
}
