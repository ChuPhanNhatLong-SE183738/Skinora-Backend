import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { SpecializationsService } from './specializations.service';
import { CreateSpecializationDto } from './dto/create-specialization.dto';
import { UpdateSpecializationDto } from './dto/update-specialization.dto';
import { Specialization } from './entities/specialization.entity';

@ApiTags('specializations')
@ApiBearerAuth()
@Controller('specializations')
export class SpecializationsController {
  constructor(private readonly specializationsService: SpecializationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async create(@Body() createSpecializationDto: CreateSpecializationDto): Promise<Specialization> {
    return this.specializationsService.create(createSpecializationDto);
  }

  @Get()
  async findAll(): Promise<Specialization[]> {
    return this.specializationsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Specialization> {
    return this.specializationsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async update(
    @Param('id') id: string, 
    @Body() updateSpecializationDto: UpdateSpecializationDto
  ): Promise<Specialization> {
    return this.specializationsService.update(id, updateSpecializationDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string): Promise<void> {
    await this.specializationsService.remove(id);
  }
}
