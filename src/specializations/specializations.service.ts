import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSpecializationDto } from './dto/create-specialization.dto';
import { UpdateSpecializationDto } from './dto/update-specialization.dto';
import { Specialization, SpecializationDocument } from './entities/specialization.entity';

@Injectable()
export class SpecializationsService {
  constructor(
    @InjectModel(Specialization.name)
    private specializationModel: Model<SpecializationDocument>,
  ) {}

  async create(createSpecializationDto: CreateSpecializationDto): Promise<any> {
    const created = new this.specializationModel(createSpecializationDto);
    const result = await created.save();
    return {
      success: true,
      message: 'Specialization created successfully',
      data: result,
    };
  }

  async findAll(): Promise<any> {
    const specializations = await this.specializationModel.find().exec();
    return {
      success: true,
      message: 'Specializations retrieved successfully',
      data: specializations,
    };
  }

  async findOne(id: string): Promise<any> {
    const specialization = await this.specializationModel.findById(id).exec();
    if (!specialization) {
      throw new NotFoundException(`Specialization #${id} not found`);
    }
    return {
      success: true,
      message: 'Specialization retrieved successfully',
      data: specialization,
    };
  }

  async update(id: string, updateSpecializationDto: UpdateSpecializationDto): Promise<any> {
    const updated = await this.specializationModel.findByIdAndUpdate(
      id,
      updateSpecializationDto,
      { new: true },
    ).exec();
    if (!updated) {
      throw new NotFoundException(`Specialization #${id} not found`);
    }
    return {
      success: true,
      message: 'Specialization updated successfully',
      data: updated,
    };
  }

  async remove(id: string): Promise<any> {
    const deleted = await this.specializationModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`Specialization #${id} not found`);
    }
    return {
      success: true,
      message: 'Specialization deleted successfully',
      data: deleted,
    };
  }
}
